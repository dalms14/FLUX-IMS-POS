const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Refund = require('../models/Refund');
const { getInventoryHistory } = require('../services/inventoryHistory');
const { processRefund, annotateRefunds } = require('../services/transactionRefunds');
const SystemAudit = require('../models/SystemAudit');

function parseEndDate(value) {
    const end = new Date(value);
    if (!String(value).includes('T')) {
        end.setHours(23, 59, 59, 999);
    }
    return end;
}

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
const TRANSACTION_FILTER_STATUSES = [...TRANSACTION_HISTORY_STATUSES, 'refund pending', 'partial refund', 'refunded'];

// Get all transactions (with optional filters)
router.get('/transactions', async (req, res) => {
    try {
        const { cashier, paymentMethod, startDate, endDate, includeActive, status } = req.query;
        if (status && !TRANSACTION_FILTER_STATUSES.includes(status)) {
            return res.status(400).json({ success: false, message: 'Select a valid transaction status.' });
        }
        
        console.log('Transaction query params:', { cashier, paymentMethod, startDate, endDate, includeActive });
        
        let filter = {};
        if (includeActive !== 'true') {
            filter.orderStatus = { $in: TRANSACTION_HISTORY_STATUSES };
            console.log('Filtering by completed/cancelled only');
        } else {
            console.log('Including ALL order statuses');
        }
        
        const cashierSearch = String(cashier || '').trim();
        if (cashierSearch) {
            filter.cashier = { $regex: escapeRegex(cashierSearch), $options: 'i' };
        }
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
        
        console.log(`Found ${transactions.length} transactions with filter:`, filter);
            
        const annotated = await annotateRefunds(transactions);
        const matching = status ? annotated.filter(transaction => transaction.refundSummary.status === status) : annotated;
        res.json({
            success: true,
            count: matching.length,
            data: matching
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
        
        res.json({ success: true, data: (await annotateRefunds([transaction]))[0] });
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
            .select('items cancelledItems createdAt orderStatus subtotal tax discount total discountInfo customerType paymentMethod')
            .lean();

        const annotatedTransactions = await annotateRefunds(transactions);
        const products = new Map();
        const orderIds = new Set();
        let totalQty = 0;
        let totalRevenue = 0;

        for (const transaction of annotatedTransactions) {
            orderIds.add(String(transaction._id));
            const annotated = transaction;

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

// Recorded stock movements, including approved purchase-order receipts.
router.get('/inventory-history', async (req, res) => {
    try {
        const data = await getInventoryHistory(req.query);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching inventory history:', error.message);
        res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Could not load inventory history.' });
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

// Confirm a refund against the saved sale. Receipt, amounts and actor are server-owned.
router.post('/refunds', async (req, res) => {
    try {
        const result = await processRefund(req.body, req.user);
        res.status(result.replayed ? 200 : 201).json({ success: true, message: 'Refund recorded. Return the amount using the original payment method.', data: result.refund });
    } catch (error) {
        console.error('Error processing refund:', error.message);
        const requiresReplicaSet = error.code === 20 || /Transaction numbers are only allowed/.test(error.message);
        res.status(error.status || (requiresReplicaSet ? 503 : 500)).json({ success: false,
            message: error.status ? error.message : requiresReplicaSet ? 'Refunds require database transaction support. No refund was saved; contact the administrator.' : 'Could not save the refund. Please retry the same request.' });
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
