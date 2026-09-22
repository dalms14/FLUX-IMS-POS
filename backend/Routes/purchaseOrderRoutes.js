const express = require('express');
const router = express.Router();
const PurchaseOrder = require('../models/PurchaseOrder');
const Inventory = require('../models/Inventory');
const SystemAudit = require('../models/SystemAudit');
const Notification = require('../models/Notification');
const User = require('../models/User');

const roundQuantity = value => Math.round((Number(value) || 0) * 1000) / 1000;
const validDate = value => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

async function createAudit(data) {
    await SystemAudit.create(data);
}

async function nextPurchaseOrderNo() {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await PurchaseOrder.countDocuments({ purchaseOrderNo: new RegExp(`^PO-${date}-`) });
    return `PO-${date}-${String(count + 1).padStart(3, '0')}`;
}

function normalizeItems(items) {
    if (!Array.isArray(items) || items.length === 0) return [];
    return items.map(item => ({
        inventoryId: item.inventoryId || null,
        name: String(item.name || '').trim(),
        unit: String(item.unit || '').trim(),
        category: String(item.category || 'General').trim(),
        lowStockAt: Math.max(0, roundQuantity(item.lowStockAt)),
        orderedQuantity: roundQuantity(item.orderedQuantity),
        unitCost: Math.max(0, Number(item.unitCost) || 0),
    }));
}

function isPurchaseOrderApprover(user) {
    const role = String(user?.role || '').trim().toLowerCase();
    const email = String(user?.email || '').trim().toLowerCase();
    const userId = String(user?.userId || '').trim().toUpperCase();
    return ['owner', 'admin'].includes(role) || email === 'admin@elicoffee.com' || userId === 'ELI001';
}

router.get('/', async (req, res) => {
    try {
        const filter = req.query.status ? { status: req.query.status } : {};
        const orders = await PurchaseOrder.find(filter).sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) {
        console.error('Error fetching purchase orders:', err);
        res.status(500).json({ message: 'Failed to fetch purchase orders' });
    }
});

router.get('/my-deliveries', async (req, res) => {
    try {
        const email = String(req.query.email || '').trim().toLowerCase();
        if (!email) return res.status(400).json({ message: 'Email is required' });
        const orders = await PurchaseOrder.find({
            'assignedReceiver.email': email,
            status: { $in: ['Approved', 'Partially Received'] },
        }).sort({ expectedDeliveryDate: 1, createdAt: -1 });
        res.json({ success: true, data: orders });
    } catch (err) {
        console.error('Error loading assigned deliveries:', err);
        res.status(500).json({ message: 'Failed to load assigned deliveries' });
    }
});

router.post('/', async (req, res) => {
    try {
        const supplierName = String(req.body.supplierName || '').trim();
        const items = normalizeItems(req.body.items);
        const assignedReceiverEmail = String(req.body.assignedReceiverEmail || '').trim().toLowerCase();
        if (!supplierName || items.length === 0 || items.some(item => !item.name || !item.unit || item.orderedQuantity <= 0)) {
            return res.status(400).json({ message: 'Supplier and at least one valid order item are required' });
        }
        const assignedReceiver = assignedReceiverEmail ? await User.findOne({ email: assignedReceiverEmail }) : null;
        if (!assignedReceiver) return res.status(400).json({ message: 'Assign a valid staff member to receive this purchase order' });

        const order = await PurchaseOrder.create({
            purchaseOrderNo: await nextPurchaseOrderNo(),
            supplierName,
            supplierContact: String(req.body.supplierContact || '').trim(),
            orderDate: validDate(req.body.orderDate) || new Date(),
            expectedDeliveryDate: validDate(req.body.expectedDeliveryDate),
            notes: String(req.body.notes || '').trim(),
            assignedReceiver: { userId: assignedReceiver._id, name: assignedReceiver.name, email: assignedReceiver.email },
            items,
            createdBy: String(req.body.actor || 'System'),
            createdByEmail: String(req.body.actorEmail || ''),
        });

        await createAudit({
            module: 'Purchase Orders', action: 'Created', entityId: String(order._id), entityName: order.purchaseOrderNo,
            actor: order.createdBy, actorEmail: order.createdByEmail,
            details: `Purchase order created for ${order.supplierName}`,
            changes: { supplierName: order.supplierName, itemCount: items.length, status: order.status, assignedReceiver: order.assignedReceiver.name },
        });
        res.status(201).json({ success: true, order });
    } catch (err) {
        console.error('Error creating purchase order:', err);
        res.status(500).json({ message: 'Failed to create purchase order' });
    }
});

router.post('/:id/approve', async (req, res) => {
    try {
        const actorEmail = String(req.body.actorEmail || '').trim().toLowerCase();
        const approver = actorEmail ? await User.findOne({ email: actorEmail }) : null;
        if (!isPurchaseOrderApprover(approver)) return res.status(403).json({ message: 'Only the Owner or an Admin can approve a purchase order.' });
        const order = await PurchaseOrder.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Purchase order not found' });
        if (order.status !== 'Draft') return res.status(400).json({ message: 'Only draft purchase orders can be approved' });

        order.status = 'Approved';
        order.approvedBy = String(req.body.actor || approver.name || 'System');
        order.approvedAt = new Date();
        await order.save();
        await createAudit({
            module: 'Purchase Orders', action: 'Approved', entityId: String(order._id), entityName: order.purchaseOrderNo,
            actor: order.approvedBy, actorEmail: String(req.body.actorEmail || ''), details: 'Purchase order approved', changes: { status: order.status },
        });
        res.json({ success: true, order });
    } catch (err) {
        console.error('Error approving purchase order:', err);
        res.status(500).json({ message: 'Failed to approve purchase order' });
    }
});

router.post('/:id/cancel', async (req, res) => {
    try {
        const order = await PurchaseOrder.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Purchase order not found' });
        if (!['Draft', 'Approved'].includes(order.status)) return res.status(400).json({ message: 'This purchase order cannot be cancelled' });

        order.status = 'Cancelled';
        order.cancelledBy = String(req.body.actor || 'System');
        order.cancelledAt = new Date();
        await order.save();
        await createAudit({
            module: 'Purchase Orders', action: 'Cancelled', entityId: String(order._id), entityName: order.purchaseOrderNo,
            actor: order.cancelledBy, actorEmail: String(req.body.actorEmail || ''), details: 'Purchase order cancelled', changes: { status: order.status },
        });
        res.json({ success: true, order });
    } catch (err) {
        console.error('Error cancelling purchase order:', err);
        res.status(500).json({ message: 'Failed to cancel purchase order' });
    }
});

router.post('/:id/receive', async (req, res) => {
    return res.status(410).json({
        message: 'Goods receipt now requires arrival reporting and Finance, HR, or Owner approval before inventory changes.'
    });
    /*
    try {
        const order = await PurchaseOrder.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Purchase order not found' });
        if (!['Approved', 'Partially Received'].includes(order.status)) {
            return res.status(400).json({ message: 'Only approved purchase orders can receive stock' });
        }
        if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
            return res.status(400).json({ message: 'Enter at least one received quantity' });
        }

        const receiptItems = [];
        for (const received of req.body.items) {
            const line = order.items.id(received.itemId);
            const quantity = roundQuantity(received.quantity);
            if (!line || quantity <= 0) continue;
            const remaining = roundQuantity(line.orderedQuantity - line.receivedQuantity);
            if (quantity > remaining) return res.status(400).json({ message: `${line.name}: received quantity exceeds the remaining order quantity` });

            let inventory = line.inventoryId ? await Inventory.findById(line.inventoryId) : null;
            if (!inventory) {
                inventory = await Inventory.findOne({ name: new RegExp(`^${line.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
            }
            if (!inventory) {
                inventory = new Inventory({ name: line.name, unit: line.unit, stock: 0, lowStockAt: line.lowStockAt || 0, category: line.category || 'General' });
            }
            if (inventory.unit !== line.unit) return res.status(400).json({ message: `${line.name}: unit must match the existing inventory item (${inventory.unit})` });

            const expirationDate = validDate(received.expirationDate);
            inventory.expirationBatches.push({ quantity, expirationDate, receivedAt: new Date(), note: `Received from ${order.purchaseOrderNo}${received.note ? ` - ${String(received.note).trim()}` : ''}` });
            inventory.stock = roundQuantity(inventory.stock + quantity);
            inventory.expirationDate = inventory.expirationBatches
                .filter(batch => batch.expirationDate)
                .map(batch => batch.expirationDate)
                .sort((a, b) => new Date(a) - new Date(b))[0] || null;
            await inventory.save();

            line.inventoryId = inventory._id;
            line.receivedQuantity = roundQuantity(line.receivedQuantity + quantity);
            receiptItems.push({ itemId: line._id, inventoryId: inventory._id, name: line.name, quantity, expirationDate, note: String(received.note || '').trim() });
        }

        if (receiptItems.length === 0) return res.status(400).json({ message: 'Enter a valid received quantity' });
        order.receipts.push({
            receivedBy: String(req.body.actor || 'System'), receivedByEmail: String(req.body.actorEmail || ''), items: receiptItems,
        });
        order.status = order.items.every(item => roundQuantity(item.receivedQuantity) >= roundQuantity(item.orderedQuantity)) ? 'Received' : 'Partially Received';
        await order.save();
        await createAudit({
            module: 'Purchase Orders', action: 'Stock Received', entityId: String(order._id), entityName: order.purchaseOrderNo,
            actor: String(req.body.actor || 'System'), actorEmail: String(req.body.actorEmail || ''),
            details: `${receiptItems.length} item(s) received into inventory`,
            changes: { status: order.status, receivedItems: receiptItems.map(item => ({ name: item.name, quantity: item.quantity })) },
        });
        res.json({ success: true, order });
    } catch (err) {
        console.error('Error receiving purchase order:', err);
        res.status(500).json({ message: 'Failed to receive purchase order' });
    }
    */
});

function isReceiptApprover(user) {
    const role = String(user?.role || '').trim().toLowerCase();
    const jobRole = String(user?.jobRole || '').trim().toLowerCase();
    const email = String(user?.email || '').trim().toLowerCase();
    const userId = String(user?.userId || '').trim().toUpperCase();
    return role === 'owner' || email === 'admin@elicoffee.com' || userId === 'ELI001' || ['finance', 'hr'].includes(jobRole);
}

router.post('/:id/record-arrival', async (req, res) => {
    try {
        const actorEmail = String(req.body.actorEmail || '').trim().toLowerCase();
        const receiver = actorEmail ? await User.findOne({ email: actorEmail }) : null;
        const order = await PurchaseOrder.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Purchase order not found' });
        if (!order.assignedReceiver?.email) return res.status(400).json({ message: 'This purchase order has no assigned receiving staff member.' });
        if (String(order.assignedReceiver.email).toLowerCase() !== actorEmail && !isPurchaseOrderApprover(receiver)) {
            return res.status(403).json({ message: `Only the assigned receiver (${order.assignedReceiver.name}) can record this delivery.` });
        }
        if (!['Approved', 'Partially Received'].includes(order.status)) {
            return res.status(400).json({ message: 'Only approved purchase orders can have an arrival recorded' });
        }
        if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
            return res.status(400).json({ message: 'Enter at least one delivered quantity' });
        }

        const receiptItems = [];
        for (const delivered of req.body.items) {
            const line = order.items.id(delivered.itemId);
            const quantity = roundQuantity(delivered.quantity);
            if (!line || quantity <= 0) continue;
            const pendingQuantity = order.pendingReceipts
                .filter(receipt => receipt.status === 'Pending Approval')
                .reduce((sum, receipt) => sum + (receipt.items.find(item => String(item.itemId) === String(line._id))?.quantity || 0), 0);
            const remaining = roundQuantity(line.orderedQuantity - line.receivedQuantity - pendingQuantity);
            if (quantity > remaining) return res.status(400).json({ message: `${line.name}: delivered quantity exceeds the remaining order quantity` });
            receiptItems.push({ itemId: line._id, name: line.name, quantity, expirationDate: validDate(delivered.expirationDate), note: String(delivered.note || '').trim() });
        }
        if (receiptItems.length === 0) return res.status(400).json({ message: 'Enter a valid delivered quantity' });

        const arrival = { reportedBy: String(req.body.actor || receiver?.name || 'System'), reportedByEmail: actorEmail, items: receiptItems };
        order.pendingReceipts.push(arrival);
        order.status = 'Arrival Pending Approval';
        await order.save();
        const pendingReceipt = order.pendingReceipts[order.pendingReceipts.length - 1];
        await Notification.create({
            type: 'purchase_order_arrival', title: 'Purchase order delivery awaiting approval',
            message: `${order.purchaseOrderNo} from ${order.supplierName} was reported as delivered. Review the received items before inventory is updated.`,
            purchaseOrderId: order._id, purchaseOrderNo: order.purchaseOrderNo, audiences: ['owner', 'admin', 'finance', 'hr'],
        });
        await createAudit({
            module: 'Purchase Orders', action: 'Arrival Reported', entityId: String(order._id), entityName: order.purchaseOrderNo,
            actor: arrival.reportedBy, actorEmail: arrival.reportedByEmail,
            details: `Delivery received by ${arrival.reportedBy} at ${pendingReceipt.arrivedAt.toLocaleString()} and is awaiting Finance, HR, or Owner approval. Inventory was not changed.`,
            changes: { status: order.status, assignedReceiver: order.assignedReceiver.name, receivedBy: arrival.reportedBy, arrivalTime: pendingReceipt.arrivedAt, items: receiptItems.map(item => ({ name: item.name, quantity: item.quantity, expirationDate: item.expirationDate })) },
        });
        res.json({ success: true, order, pendingReceipt });
    } catch (err) {
        console.error('Error recording purchase order arrival:', err);
        res.status(500).json({ message: 'Failed to record arrival' });
    }
});

router.post('/:id/pending-receipts/:receiptId/approve', async (req, res) => {
    try {
        const actorEmail = String(req.body.actorEmail || '').trim().toLowerCase();
        const approver = actorEmail ? await User.findOne({ email: actorEmail }) : null;
        if (!isReceiptApprover(approver)) {
            return res.status(403).json({ message: 'Only Finance, HR, or the Owner can approve a delivered purchase order.' });
        }
        const order = await PurchaseOrder.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Purchase order not found' });
        const pendingReceipt = order.pendingReceipts.id(req.params.receiptId);
        if (!pendingReceipt || pendingReceipt.status !== 'Pending Approval') return res.status(404).json({ message: 'Pending delivery approval not found' });

        const receivedItems = [];
        for (const received of pendingReceipt.items) {
            const line = order.items.id(received.itemId);
            if (!line) return res.status(400).json({ message: 'A delivered item no longer matches this purchase order' });
            const quantity = roundQuantity(received.quantity);
            const remaining = roundQuantity(line.orderedQuantity - line.receivedQuantity);
            if (quantity > remaining) return res.status(400).json({ message: `${line.name}: approval would exceed the ordered quantity` });

            let inventory = line.inventoryId ? await Inventory.findById(line.inventoryId) : null;
            if (!inventory) inventory = await Inventory.findOne({ name: new RegExp(`^${line.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
            if (!inventory) inventory = new Inventory({ name: line.name, unit: line.unit, stock: 0, lowStockAt: line.lowStockAt || 0, category: line.category || 'General' });
            if (inventory.unit !== line.unit) return res.status(400).json({ message: `${line.name}: unit must match the existing inventory item (${inventory.unit})` });

            inventory.expirationBatches.push({ quantity, expirationDate: received.expirationDate, receivedAt: pendingReceipt.arrivedAt, note: `Received from ${order.purchaseOrderNo}${received.note ? ` - ${received.note}` : ''}` });
            inventory.stock = roundQuantity(inventory.stock + quantity);
            inventory.expirationDate = inventory.expirationBatches.filter(batch => batch.expirationDate).map(batch => batch.expirationDate).sort((a, b) => new Date(a) - new Date(b))[0] || null;
            await inventory.save();
            line.inventoryId = inventory._id;
            line.receivedQuantity = roundQuantity(line.receivedQuantity + quantity);
            receivedItems.push({ itemId: line._id, inventoryId: inventory._id, name: line.name, quantity, expirationDate: received.expirationDate, note: received.note });
        }

        pendingReceipt.status = 'Approved';
        pendingReceipt.reviewedBy = String(req.body.actor || approver.name || 'System');
        pendingReceipt.reviewedByEmail = actorEmail;
        pendingReceipt.reviewedAt = new Date();
        order.receipts.push({ receivedAt: pendingReceipt.arrivedAt, receivedBy: pendingReceipt.reportedBy, receivedByEmail: pendingReceipt.reportedByEmail, items: receivedItems });
        order.status = order.items.every(item => roundQuantity(item.receivedQuantity) >= roundQuantity(item.orderedQuantity)) ? 'Received' : 'Partially Received';
        await order.save();
        await Notification.updateMany({ type: 'purchase_order_arrival', purchaseOrderId: order._id, resolvedAt: null }, { $set: { resolvedAt: pendingReceipt.reviewedAt } });
        await createAudit({
            module: 'Purchase Orders', action: 'Delivery Approved', entityId: String(order._id), entityName: order.purchaseOrderNo,
            actor: pendingReceipt.reviewedBy, actorEmail,
            details: `Delivery arrived ${pendingReceipt.arrivedAt.toLocaleString()} and was approved ${pendingReceipt.reviewedAt.toLocaleString()}. Inventory updated after approval.`,
            changes: { status: order.status, assignedReceiver: order.assignedReceiver.name, receivedBy: pendingReceipt.reportedBy, arrivalTime: pendingReceipt.arrivedAt, approvalTime: pendingReceipt.reviewedAt, items: receivedItems.map(item => ({ name: item.name, quantity: item.quantity, expirationDate: item.expirationDate })) },
        });
        res.json({ success: true, order });
    } catch (err) {
        console.error('Error approving delivered purchase order:', err);
        res.status(500).json({ message: 'Failed to approve delivered purchase order' });
    }
});

module.exports = router;
