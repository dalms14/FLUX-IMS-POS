const mongoose = require('mongoose');
const Waste = require('../models/Waste');
const SystemAudit = require('../models/SystemAudit');
const PurchaseOrder = require('../models/PurchaseOrder');

const INVENTORY_ACTIONS = ['Stock In', 'Stock Out', 'Expired Stock Auto Deducted', 'Sale Deduction'];
const RECEIPT_ACTIONS = ['Stock Received', 'Delivery Received'];
const numeric = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const quantityText = (amount, unit) => `${numeric(amount).toLocaleString('en-PH', { maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ''}`;

function dateBounds(startDate, endDate) {
    const parse = (value, end) => {
        if (!value) return null;
        const text = String(value);
        const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T${end ? '23:59:59.999' : '00:00:00.000'}+08:00` : text);
        if (Number.isNaN(date.getTime())) throw Object.assign(new Error('Choose a valid date range.'), { status: 400 });
        return date;
    };
    const start = parse(startDate, false), end = parse(endDate, true);
    if (start && end && start > end) throw Object.assign(new Error('Start date must be on or before end date.'), { status: 400 });
    return start || end ? { createdAt: { ...(start ? { $gte: start } : {}), ...(end ? { $lte: end } : {}) } } : {};
}

function normalizeHistory(logs, waste, orders = []) {
    const orderMap = new Map(orders.map(order => [String(order._id), order]));
    const rows = [];
    const append = (row, amount, unit, direction) => {
        if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) return;
        rows.push({ ...row, amount: Number(amount), unit: unit || '', direction, quantity: quantityText(amount, unit) });
    };
    for (const log of logs) {
        const change = log.changes || {};
        const base = { _id: `audit-${log._id}`, date: log.createdAt, by: log.actor || 'System', reason: log.details || change.reason || '', reference: change.receiptNo || '', source: 'Inventory' };
        if (log.module === 'Purchase Orders' && RECEIPT_ACTIONS.includes(log.action)) {
            const order = orderMap.get(String(log.entityId));
            for (const [index, item] of (change.items || change.receivedItems || []).entries()) {
                const line = order?.items?.find(line => String(line.inventoryId) === String(item.inventoryId) && item.inventoryId)
                    || order?.items?.find(line => line.name === item.name);
                append({ ...base, _id: `${base._id}-${index}`, item: item.name, action: 'Stock In', movementType: 'received',
                    source: 'Purchase Order', reference: log.entityName || order?.purchaseOrderNo || '',
                    receivedBy: change.receivedBy || log.actor || '', reason: 'Purchase order stock received' }, item.quantity, item.unit || line?.unit, 'in');
            }
        } else if (log.module === 'Inventory' && INVENTORY_ACTIONS.includes(log.action)) {
            const movementType = { 'Stock In': 'received', 'Stock Out': 'adjustment', 'Expired Stock Auto Deducted': 'expired', 'Sale Deduction': 'sale' }[log.action];
            const amount = Number.isFinite(change.oldStock) && Number.isFinite(change.newStock) ? Math.abs(change.newStock - change.oldStock) : change.quantity;
            append({ ...base, item: log.entityName, action: log.action, movementType }, amount, change.unit, log.action === 'Stock In' ? 'in' : 'out');
        }
    }
    for (const record of waste) {
        for (const [index, item] of (record.items || []).entries()) {
            append({ _id: `waste-${record._id}-${index}`, date: record.createdAt, item: item.inventoryName || item.inventoryId?.name || 'Inventory item',
                action: 'Deducted (Refund Waste)', movementType: 'waste', by: record.disposedBy || 'System', reason: record.reason || '',
                source: 'Waste', reference: record.receiptNo || '' }, item.amountWasted, item.unit || item.inventoryId?.unit, 'out');
        }
    }
    return rows.sort((a, b) => new Date(b.date) - new Date(a.date) || a._id.localeCompare(b._id));
}

async function getInventoryHistory({ startDate, endDate } = {}) {
    const filter = dateBounds(startDate, endDate);
    const [logs, waste] = await Promise.all([
        SystemAudit.find({ ...filter, $or: [
            { module: 'Inventory', action: { $in: INVENTORY_ACTIONS } },
            { module: 'Purchase Orders', action: { $in: RECEIPT_ACTIONS } },
        ] }).sort({ createdAt: -1 }).lean(),
        Waste.find(filter).populate('items.inventoryId', 'name unit').sort({ createdAt: -1 }).lean(),
    ]);
    const orderIds = [...new Set(logs.filter(log => log.module === 'Purchase Orders').map(log => log.entityId).filter(value => mongoose.isValidObjectId(value)))];
    const orders = orderIds.length ? await PurchaseOrder.find({ _id: { $in: orderIds } }).select('purchaseOrderNo items.name items.inventoryId items.unit').lean() : [];
    return normalizeHistory(logs, waste, orders);
}

// Record successful checkout usage only; failed checkouts and refunds do not
// imply a stock movement. Never reconstruct old usage from today's recipes.
async function recordSaleUsage(transaction, requirements) {
    if (!requirements.length) return;
    try {
        await SystemAudit.insertMany(requirements.map(item => ({
            module: 'Inventory', action: 'Sale Deduction', entityId: String(item.inventoryId), entityName: item.name,
            actor: transaction.cashier, actorEmail: transaction.cashierEmail,
            details: 'Ingredients used for completed sale',
            changes: { quantity: item.required, unit: item.unit, receiptNo: transaction.receiptNo, transactionId: String(transaction._id) },
        })));
    } catch (error) {
        // The sale and deduction have already completed: do not report a failed
        // checkout or restore stock merely because logging is unavailable.
        console.error('Could not record sale inventory history:', error.message);
    }
}

module.exports = { getInventoryHistory, normalizeHistory, recordSaleUsage, dateBounds };
