const mongoose = require('mongoose');
const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const Refund = require('../models/Refund');
const SystemAudit = require('../models/SystemAudit');
const { hasPermission } = require('../utils/permissions');

const fail = (status, message) => Object.assign(new Error(message), { status });
const cents = value => Math.round(Number(value || 0) * 100);
const money = value => value / 100;
const id = value => String(value?._id || value || '');
const ACTIVE = new Set(['pending', 'approved', 'completed']);

// Allocate integer centavos without losing the last centavo across partial refunds.
function allocate(amount, weights) {
    const sum = weights.reduce((a, b) => a + b, 0);
    if (!sum) {
        if (amount) throw fail(409, 'This receipt needs review before it can be refunded.');
        return weights.map(() => 0);
    }
    const raw = weights.map(weight => amount * weight / sum);
    const result = raw.map(Math.floor);
    const order = raw.map((value, index) => ({ index, remainder: value - result[index] }))
        .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
    for (let n = amount - result.reduce((a, b) => a + b, 0), i = 0; i < n; i++) result[order[i].index]++;
    return result;
}

function lineAmounts(transaction) {
    const items = transaction.items || [];
    const gross = items.map(item => cents(item.subtotal ?? Number(item.price) * Number(item.quantity)));
    const subtotal = gross.reduce((a, b) => a + b, 0);
    const discount = cents(transaction.discount);
    const tax = cents(transaction.tax);
    const total = cents(transaction.total);
    if (!items.length || items.some((item, index) => !Number.isSafeInteger(item.quantity) || item.quantity < 1 || !Number.isSafeInteger(gross[index]) || gross[index] < 0)
        || ![subtotal, discount, tax, total].every(Number.isSafeInteger) || discount < 0 || discount > subtotal || tax < 0 || total < 0
        || subtotal !== cents(transaction.subtotal) || total !== subtotal + tax - discount) {
        throw fail(409, 'This receipt needs review before it can be refunded.');
    }
    const scoped = transaction.discountInfo?.scope === 'item'
        || (!transaction.discountInfo?.scope && ['pwd_senior', 'pagibig'].includes(transaction.customerType));
    const weights = scoped ? items.map((item, index) => gross[index] * Math.min(item.quantity, Math.max(0, Number(item.discountEligibleQuantity || 0))) / item.quantity) : gross;
    const discounts = allocate(discount, weights);
    if (discounts.some((amount, index) => amount > gross[index])) throw fail(409, 'This receipt needs review before it can be refunded.');
    const taxes = allocate(tax, gross);
    return items.map((item, index) => ({ subtotal: gross[index], discount: discounts[index], tax: taxes[index], total: gross[index] - discounts[index] + taxes[index] }));
}

function refundView(transaction, refunds = []) {
    const source = transaction.toObject ? transaction.toObject() : transaction;
    const used = (source.items || []).map(() => 0);
    const reserved = used.slice();
    const linked = new Set();
    for (const item of source.cancelledItems || []) {
        if (Number.isInteger(item.originalIndex) && used[item.originalIndex] !== undefined) used[item.originalIndex] += Number(item.quantity || 0);
        if (item.refundId) linked.add(id(item.refundId));
    }
    const active = refunds.filter(refund => ACTIVE.has(refund.status));
    for (const refund of active) {
        if (linked.has(id(refund._id))) continue; // Earlier order cancellations already have a line ledger.
        const bucket = refund.status === 'pending' ? reserved : used;
        for (const item of refund.items || []) {
            let remaining = Number(item.quantity || 0);
            const indexes = Number.isInteger(item.originalIndex) ? [item.originalIndex] : source.items.map((line, index) =>
                (item.productId ? id(line.productId) === id(item.productId) : line.name === item.name) ? index : -1).filter(index => index >= 0);
            for (const index of indexes) {
                if (!source.items[index]) continue;
                const taken = Math.min(remaining, Math.max(0, source.items[index].quantity - used[index] - reserved[index]));
                bucket[index] += taken;
                remaining -= taken;
                if (remaining <= 0) break;
            }
        }
    }
    let amounts;
    let unavailableReason = '';
    try { amounts = lineAmounts(source); } catch (error) { unavailableReason = error.message; }
    const refundedTotal = active.filter(row => row.status !== 'pending').reduce((sum, row) => sum + cents(row.totalRefunded), 0);
    const reservedTotal = active.reduce((sum, row) => sum + cents(row.totalRefunded), 0);
    const eligible = source.orderStatus === 'completed' && ['Cash', 'GCash'].includes(source.paymentMethod);
    const items = (source.items || []).map((item, index) => ({
        ...item,
        originalIndex: index,
        refundedQuantity: Math.min(item.quantity, used[index]),
        activeQuantity: Math.max(0, item.quantity - used[index]),
        reservedRefundQuantity: reserved[index],
        refundableQuantity: Math.max(0, item.quantity - used[index] - reserved[index]),
        refundLineAmounts: amounts?.[index],
    }));
    const canRefund = eligible && !unavailableReason && items.some(item => item.refundableQuantity > 0) && reservedTotal < cents(source.total);
    return { ...source, items, refundSummary: { canRefund, totalRefunded: money(refundedTotal), remainingAmount: money(Math.max(0, cents(source.total) - reservedTotal)), unavailableReason } };
}

async function annotateRefunds(transactions) {
    if (!transactions.length) return [];
    const refunds = await Refund.find({ transactionId: { $in: transactions.map(row => row._id) }, status: { $in: [...ACTIVE] } }).lean();
    const grouped = new Map();
    for (const refund of refunds) {
        const key = id(refund.transactionId);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(refund);
    }
    return transactions.map(row => refundView(row, grouped.get(id(row._id)) || []));
}

function normalizeRequest(body) {
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason || reason.length > 150) throw fail(400, 'Enter a refund reason of 1 to 150 characters.');
    if (!mongoose.isValidObjectId(body.transactionId) || !/^[a-zA-Z0-9_-]{16,100}$/.test(body.requestId || '')
        || !Array.isArray(body.items) || !body.items.length || body.items.length > 200) {
        throw fail(400, 'Select a transaction and the items to refund.');
    }
    const seen = new Set();
    const items = body.items.map(item => {
        if (!Number.isSafeInteger(item.originalIndex) || item.originalIndex < 0 || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || seen.has(item.originalIndex)) {
            throw fail(400, 'Choose each receipt item once with a valid whole-number quantity.');
        }
        seen.add(item.originalIndex);
        return { originalIndex: item.originalIndex, quantity: item.quantity };
    }).sort((a, b) => a.originalIndex - b.originalIndex);
    return { transactionId: body.transactionId, requestId: body.requestId, reason, items };
}

async function processRefund(body, actor) {
    if (!hasPermission(actor, 'transactions') && !hasPermission(actor, 'history')) throw fail(403, 'Your account cannot process refunds.');
    const input = normalizeRequest(body);
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify({ reason: input.reason, items: input.items, actor: actor.email })).digest('hex');
    const session = await mongoose.startSession();
    let result;
    try {
        await session.withTransaction(async () => {
            const transaction = await Transaction.findById(input.transactionId).session(session).lean();
            if (!transaction) throw fail(404, 'Transaction not found.');
            const refunds = await Refund.find({ transactionId: transaction._id }).session(session).lean();
            const previous = refunds.find(row => row.requestId === input.requestId);
            if (previous) {
                if (previous.requestFingerprint !== fingerprint) throw fail(409, 'This refund request was already used. Refresh and try again.');
                result = { refund: previous, replayed: true };
                return;
            }
            if (transaction.orderStatus !== 'completed' || !['Cash', 'GCash'].includes(transaction.paymentMethod)) throw fail(400, 'Only completed paid transactions can be refunded.');
            const view = refundView(transaction, refunds);
            if (!view.refundSummary.canRefund) throw fail(409, view.refundSummary.unavailableReason || 'This transaction has no remaining amount to refund.');
            const parts = input.items.map(selection => {
                const item = view.items[selection.originalIndex];
                if (!item || selection.quantity > item.refundableQuantity) throw fail(409, 'A selected quantity is no longer available. Close and reopen the refund form.');
                // Pending legacy requests reserve receipt quantities until reviewed.
                if (item.reservedRefundQuantity) throw fail(409, 'Review the pending refund for this item first.');
                const slice = amount => Math.round(amount * (item.refundedQuantity + selection.quantity) / item.quantity) - Math.round(amount * item.refundedQuantity / item.quantity);
                return { originalIndex: selection.originalIndex, productId: item.productId, name: item.name, quantity: selection.quantity,
                    price: item.price, subtotal: money(slice(item.refundLineAmounts.subtotal)),
                    tax: slice(item.refundLineAmounts.tax), total: slice(item.refundLineAmounts.total) };
            });
            const sum = key => parts.reduce((total, item) => total + (key === 'subtotal' ? cents(item[key]) : item[key]), 0);
            const total = sum('total');
            if (total <= 0 || total > cents(view.refundSummary.remainingAmount)) throw fail(409, 'The selected refund exceeds the remaining paid amount or has no refundable value.');
            // Writing the sale serializes concurrent refunds. Mongo retries write conflicts
            // against a fresh snapshot, so the next request sees the already-refunded units.
            const write = await Transaction.updateOne({ _id: transaction._id, orderStatus: 'completed',
                ...(transaction.refundVersion == null ? { $or: [{ refundVersion: 0 }, { refundVersion: { $exists: false } }] } : { refundVersion: transaction.refundVersion }) },
            { $inc: { refundVersion: 1 } }, { session });
            if (write.matchedCount !== 1) throw fail(409, 'This transaction changed. Refresh before refunding.');
            const [refund] = await Refund.create([{
                transactionId: transaction._id, receiptNo: transaction.receiptNo,
                requestId: input.requestId, requestFingerprint: fingerprint,
                items: parts.map(({ tax, total, ...item }) => item), reason: input.reason,
                subtotal: money(sum('subtotal')), tax: money(sum('tax')), discount: money(sum('subtotal') + sum('tax') - total), totalRefunded: money(total),
                refundedBy: actor.name || actor.email, refundedByEmail: actor.email,
                paymentMethod: transaction.paymentMethod, status: 'completed',
            }], { session });
            await SystemAudit.create([{
                module: 'Refunds', action: 'Completed', entityId: String(refund._id), entityName: transaction.receiptNo,
                actor: actor.name || actor.email, actorEmail: actor.email,
                details: input.reason, changes: { transactionId: String(transaction._id), totalRefunded: money(total), items: input.items, stockReturned: false },
            }], { session });
            result = { refund, replayed: false };
        });
        return result;
    } finally { await session.endSession(); }
}

module.exports = { processRefund, annotateRefunds, refundView, lineAmounts };
