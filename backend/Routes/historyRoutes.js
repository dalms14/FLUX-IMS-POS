const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Refund = require('../models/Refund');
const Waste = require('../models/Waste');
const Recipe = require('../models/Recipe');
const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const SystemAudit = require('../models/SystemAudit');

function parseEndDate(value) {
    const end = new Date(value);
    if (!String(value).includes('T')) {
        end.setHours(23, 59, 59, 999);
    }
    return end;
}

function roundMoney(value) {
    return Math.round(Number(value || 0) * 100) / 100;
}

async function logRefundAudit(action, refund, details) {
    try {
        await SystemAudit.create({
            module: 'Refunds',
            action,
            entityId: refund?._id || '',
            entityName: refund?.receiptNo || '',
            actor: refund?.refundedBy || 'System',
            actorEmail: refund?.refundedByEmail || '',
            details,
            changes: {
                receiptNo: refund?.receiptNo || '',
                status: refund?.status || '',
                totalRefunded: refund?.totalRefunded || 0,
            },
        });
    } catch (err) {
        console.error('Refund audit error:', err.message);
    }
}

// ========== TRANSACTION ROUTES ==========

const TRANSACTION_HISTORY_STATUSES = ['completed', 'cancelled'];

function annotateRefundedTransactionItems(transaction) {
    const refundedByIndex = new Map();

    for (const cancelled of transaction.cancelledItems || []) {
        const index = Number(cancelled.originalIndex);
        if (!Number.isInteger(index)) continue;
        const current = refundedByIndex.get(index) || { quantity: 0, refundIds: [], reasons: [] };
        current.quantity += Number(cancelled.quantity || 0);
        if (cancelled.refundId) current.refundIds.push(cancelled.refundId);
        if (cancelled.reason) current.reasons.push(cancelled.reason);
        refundedByIndex.set(index, current);
    }

    return {
        ...transaction,
        items: (transaction.items || []).map((item, index) => {
            const refunded = refundedByIndex.get(index);
            const refundedQuantity = Math.min(Number(item.quantity || 0), Number(refunded?.quantity || 0));
            return {
                ...item,
                refundedQuantity,
                activeQuantity: Math.max(0, Number(item.quantity || 0) - refundedQuantity),
                refundStatus: refundedQuantity > 0 ? 'completed' : '',
                refundIds: refunded?.refundIds || [],
                refundReasons: refunded?.reasons || [],
            };
        }),
    };
}

// Get all transactions (with optional filters)
router.get('/transactions', async (req, res) => {
    try {
        const { cashier, paymentMethod, startDate, endDate, includeActive } = req.query;
        
        let filter = {};
        if (includeActive !== 'true') {
            filter.orderStatus = { $in: TRANSACTION_HISTORY_STATUSES };
        }
        
        if (cashier) filter.cashier = cashier;
        if (paymentMethod) filter.paymentMethod = paymentMethod;
        
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = parseEndDate(endDate);
        }
        
        const transactions = await Transaction.find(filter)
            .populate('items.productId', 'name category')
            .sort({ createdAt: -1 })
            .lean();
            
        res.json({
            success: true,
            count: transactions.length,
            data: transactions.map(annotateRefundedTransactionItems)
        });
    } catch (err) {
        console.error('Error fetching transactions:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get single transaction
router.get('/transactions/:id', async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id)
            .populate('items.productId', 'name category price')
            .lean();
            
        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }
        
        res.json({ success: true, data: annotateRefundedTransactionItems(transaction) });
    } catch (err) {
        console.error('Error fetching transaction:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get sales history (grouped by product)
router.get('/sales-history', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        const filter = { orderStatus: 'completed' };
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = parseEndDate(endDate);
        }

        const transactions = await Transaction.find(filter)
            .select('items cancelledItems createdAt orderStatus')
            .lean();

        const products = new Map();
        const orderIds = new Set();
        let totalQty = 0;
        let totalRevenue = 0;

        for (const transaction of transactions) {
            orderIds.add(String(transaction._id));
            const annotated = annotateRefundedTransactionItems(transaction);

            for (const item of annotated.items || []) {
                const originalQty = Number(item.quantity || 0);
                const activeQty = Math.max(0, Number(item.activeQuantity ?? originalQty));
                if (!activeQty) continue;

                const unitSubtotal = originalQty > 0
                    ? Number(item.subtotal || 0) / originalQty
                    : Number(item.price || 0);
                const revenue = roundMoney(unitSubtotal * activeQty);
                const productId = item.productId?._id || item.productId || item.name || 'unknown';
                const key = String(productId);
                const current = products.get(key) || {
                    _id: key,
                    productName: item.name || 'Unnamed product',
                    category: item.category || 'Uncategorized',
                    totalQty: 0,
                    totalRevenue: 0,
                    orderIds: new Set(),
                    lastSoldAt: transaction.createdAt,
                };

                current.totalQty += activeQty;
                current.totalRevenue = roundMoney(current.totalRevenue + revenue);
                current.orderIds.add(String(transaction._id));
                if (new Date(transaction.createdAt) > new Date(current.lastSoldAt || 0)) {
                    current.lastSoldAt = transaction.createdAt;
                }

                products.set(key, current);
                totalQty += activeQty;
                totalRevenue = roundMoney(totalRevenue + revenue);
            }
        }

        const salesData = Array.from(products.values())
            .map(product => ({
                _id: product._id,
                productName: product.productName,
                category: product.category,
                totalQty: product.totalQty,
                totalRevenue: product.totalRevenue,
                avgPrice: product.totalQty ? roundMoney(product.totalRevenue / product.totalQty) : 0,
                transactionCount: product.orderIds.size,
                lastSoldAt: product.lastSoldAt,
            }))
            .sort((a, b) => b.totalRevenue - a.totalRevenue || b.totalQty - a.totalQty);

        res.json({
            success: true,
            data: salesData,
            summary: {
                productCount: salesData.length,
                orderCount: orderIds.size,
                totalQty,
                totalRevenue,
            },
        });
    } catch (err) {
        console.error('Error fetching sales history:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get inventory history (changes)
router.get('/inventory-history', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        let filter = {};
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = parseEndDate(endDate);
        }
        
        // Get waste records as inventory deductions
        const waste = await Waste.find(filter)
            .populate('items.inventoryId', 'name unit')
            .sort({ createdAt: -1 })
            .lean();
        
        const inventoryHistory = waste.map(w => ({
            date: w.createdAt,
            item: w.items.map(i => i.inventoryName).join(', '),
            action: 'Deducted (Refund Waste)',
            quantity: w.items.map(i => `${i.amountWasted}${i.unit}`).join(', '),
            by: w.disposedBy,
            reason: w.reason
        }));
        const manualStockOut = await SystemAudit.find({
            ...filter,
            module: 'Inventory',
            action: 'Stock Out',
        }).sort({ createdAt: -1 }).lean();

        const manualStockOutHistory = manualStockOut.map(log => ({
            date: log.createdAt,
            item: log.entityName,
            action: 'Stock Out',
            quantity: `${log.changes?.quantity || 0}${log.changes?.unit ? ` ${log.changes.unit}` : ''}`,
            by: log.actor,
            reason: log.details || log.changes?.reason || '',
        }));
        
        res.json({
            success: true,
            data: [...inventoryHistory, ...manualStockOutHistory]
                .sort((a, b) => new Date(b.date) - new Date(a.date)),
        });
    } catch (err) {
        console.error('Error fetching inventory history:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ========== REFUND ROUTES ==========

// Get all refunds
router.get('/refunds', async (req, res) => {
    try {
        const { status, cashier, startDate, endDate } = req.query;
        
        let filter = {};
        if (status) filter.status = status;
        if (cashier) filter.refundedBy = cashier;
        
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = parseEndDate(endDate);
        }
        
        const refunds = await Refund.find(filter)
            .populate('transactionId', 'receiptNo items total')
            .sort({ createdAt: -1 })
            .lean();
            
        res.json({ success: true, count: refunds.length, data: refunds });
    } catch (err) {
        console.error('Error fetching refunds:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get single refund
router.get('/refunds/:id', async (req, res) => {
    try {
        const refund = await Refund.findById(req.params.id)
            .populate('transactionId')
            .populate('items.productId')
            .lean();
            
        if (!refund) {
            return res.status(404).json({ success: false, message: 'Refund not found' });
        }
        
        res.json({ success: true, data: refund });
    } catch (err) {
        console.error('Error fetching refund:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Create refund
router.post('/refunds', async (req, res) => {
    try {
        const { transactionId, receiptNo, items, reason, refundedBy, refundedByEmail, paymentMethod } = req.body;
        
        if (!transactionId || !items || !reason || !refundedBy) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields' 
            });
        }
        
        // Get original transaction
        const transaction = await Transaction.findById(transactionId);
        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }

        if ((transaction.orderStatus || 'pending') !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Refunds are only allowed while the order is pending. Preparing, ready, completed, and cancelled orders are final.',
            });
        }
        
        let subtotal = 0;
        let totalRefunded = 0;
        let tax = 0;
        const processedItems = [];
        
        // Process each refunded item
        for (const item of items) {
            const product = await Product.findById(item.productId);
            if (!product) continue;
            
            const itemSubtotal = item.price * item.quantity;
            subtotal += itemSubtotal;
            
            // Check if product is made (has recipe)
            const recipe = await Recipe.findOne({ productId: item.productId });
            const isMade = !!recipe;
            
            processedItems.push({
                productId: item.productId,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                subtotal: itemSubtotal,
                isMade: isMade
            });
        }
        
        // Calculate tax proportionally
        const refundPercentage = subtotal / transaction.subtotal;
        tax = transaction.tax * refundPercentage;
        totalRefunded = subtotal + tax;
        
        // Create refund record
        const refund = new Refund({
            transactionId,
            receiptNo,
            items: processedItems,
            reason,
            subtotal,
            tax,
            totalRefunded,
            refundedBy,
            refundedByEmail,
            paymentMethod: paymentMethod || transaction.paymentMethod,
            status: 'pending'
        });
        
        await refund.save();
        await logRefundAudit('Created', refund, 'Refund request created');
        
        // Process waste items (for made products)
        const wasteItems = [];
        for (const item of processedItems) {
            if (item.isMade) {
                const recipe = await Recipe.findOne({ productId: item.productId });
                if (recipe) {
                    for (const ingredient of recipe.ingredients) {
                        const amountWasted = ingredient.amountPerServing * item.quantity;
                        wasteItems.push({
                            inventoryId: ingredient.inventoryId,
                            inventoryName: ingredient.name,
                            unit: ingredient.unit,
                            amountWasted: amountWasted
                        });
                    }
                }
            } else {
                // For non-made items, add back to inventory
                const inventory = await Inventory.findOne({ name: item.name });
                if (inventory) {
                    inventory.stock += item.quantity;
                    await inventory.save();
                }
            }
        }
        
        // Create waste record if there are made items
        if (wasteItems.length > 0) {
            const waste = new Waste({
                refundId: refund._id,
                transactionId,
                receiptNo,
                items: wasteItems,
                reason: `Refunded - ${reason}`,
                disposedBy: refundedBy
            });
            await waste.save();
        }
        
        res.status(201).json({
            success: true,
            message: 'Refund created successfully',
            data: refund
        });
    } catch (err) {
        console.error('Error creating refund:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

// Approve refund
router.patch('/refunds/:id/approve', async (req, res) => {
    try {
        const refund = await Refund.findById(req.params.id);
        if (!refund) {
            return res.status(404).json({ success: false, message: 'Refund not found' });
        }

        if (refund.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Only pending refunds can be approved. Current status: ${refund.status}`
            });
        }
        
        refund.status = 'approved';
        await refund.save();
        await logRefundAudit('Approved', refund, 'Refund request approved');
        
        res.json({
            success: true,
            message: 'Refund approved',
            data: refund
        });
    } catch (err) {
        console.error('Error approving refund:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Complete approved refund
router.patch('/refunds/:id/complete', async (req, res) => {
    try {
        const refund = await Refund.findById(req.params.id);
        if (!refund) {
            return res.status(404).json({ success: false, message: 'Refund not found' });
        }

        if (refund.status !== 'approved') {
            return res.status(400).json({
                success: false,
                message: `Only approved refunds can be completed. Current status: ${refund.status}`
            });
        }

        refund.status = 'completed';
        await refund.save();
        await logRefundAudit('Completed', refund, 'Refund marked as completed');

        res.json({
            success: true,
            message: 'Refund completed',
            data: refund
        });
    } catch (err) {
        console.error('Error completing refund:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Reject refund
router.patch('/refunds/:id/reject', async (req, res) => {
    try {
        const refund = await Refund.findById(req.params.id);
        if (!refund) {
            return res.status(404).json({ success: false, message: 'Refund not found' });
        }

        if (refund.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Completed refunds cannot be rejected'
            });
        }
        
        refund.status = 'rejected';
        await refund.save();
        await logRefundAudit('Rejected', refund, 'Refund request rejected');
        
        res.json({
            success: true,
            message: 'Refund rejected',
            data: refund
        });
    } catch (err) {
        console.error('Error rejecting refund:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
