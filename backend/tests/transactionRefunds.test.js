const { test, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Refund = require('../models/Refund');
const SystemAudit = require('../models/SystemAudit');
const Inventory = require('../models/Inventory');
const { processRefund, refundView, annotateRefunds } = require('../services/transactionRefunds');

const saleId = '123456789012345678901234';
const actor = { name: 'Cashier', email: 'cashier@example.com', role: 'staff' };
let sale, refunds, audits, tail;
const query = read => ({ session() { return this; }, lean: async () => structuredClone(read()) });
const request = (items = [{ originalIndex: 0, quantity: 1 }], key = 'request_0123456789') => ({ transactionId: saleId, requestId: key, reason: 'Wrong order served', items });

beforeEach(() => {
    sale = { _id: saleId, receiptNo: 'FLX-REFUND-TEST', orderStatus: 'completed', cashier: 'Original cashier', paymentMethod: 'Cash', refundVersion: 0,
        subtotal: 400, tax: 0, discount: 60, total: 340, discountInfo: { scope: 'item' },
        items: [{ productId: '123456789012345678901230', name: 'Coffee', quantity: 3, price: 100, subtotal: 300, discountEligibleQuantity: 3 },
            { productId: '123456789012345678901230', name: 'Coffee Large', quantity: 1, price: 100, subtotal: 100, discountEligibleQuantity: 0 }] };
    refunds = []; audits = []; tail = Promise.resolve();
    mock.method(mongoose, 'startSession', async () => ({
        async withTransaction(fn) {
            const run = tail.then(async () => {
                const snapshot = structuredClone({ sale, refunds, audits });
                try { return await fn(); }
                catch (error) { ({ sale, refunds, audits } = snapshot); throw error; }
            });
            tail = run.catch(() => {});
            return run;
        }, async endSession() {},
    }));
    mock.method(Transaction, 'findById', value => query(() => value === saleId ? sale : null));
    mock.method(Transaction, 'updateOne', async (filter, update, options) => {
        assert.ok(options.session);
        assert.equal(filter.orderStatus, 'completed');
        assert.deepEqual(update, { $inc: { refundVersion: 1 } });
        if (filter.refundVersion !== sale.refundVersion) return { matchedCount: 0 };
        sale.refundVersion++; return { matchedCount: 1 };
    });
    mock.method(Refund, 'find', () => query(() => refunds));
    mock.method(Refund, 'create', async (rows, options) => { assert.ok(options.session); const row = { ...rows[0], _id: `refund${refunds.length}` }; refunds.push(row); return [row]; });
    mock.method(SystemAudit, 'create', async (rows, options) => { assert.ok(options.session); audits.push(...rows); return rows; });
    mock.method(Inventory, 'updateOne', () => { throw new Error('Refunds must not restock prepared goods'); });
    mock.method(Inventory, 'findOne', () => { throw new Error('Refunds must not restock prepared goods'); });
});
afterEach(() => mock.restoreAll());

test('transaction status separates refund activity from completed and cancelled sales', () => {
    const status = (rows = [], transaction = sale) => refundView(transaction, rows).refundSummary.status;
    assert.equal(status(), 'completed');
    assert.equal(status([{ status: 'rejected', totalRefunded: 100 }]), 'completed');
    assert.equal(status([{ status: 'pending', totalRefunded: 100 }]), 'refund pending');
    assert.equal(status([{ status: 'completed', totalRefunded: 100 }]), 'partial refund');
    assert.equal(status([{ status: 'approved', totalRefunded: 100 }, { status: 'completed', totalRefunded: 240 }]), 'refunded');
    assert.equal(status([{ status: 'completed', totalRefunded: 340 }, { status: 'pending', totalRefunded: 1 }]), 'refund pending');
    assert.equal(status([], { ...sale, orderStatus: 'cancelled' }), 'cancelled');
    assert.equal(status([], { ...sale, paymentMethod: 'Cancelled' }), 'cancelled');
});

test('completed partial refund uses receipt prices and eligible discounts, preserves the sale, and records its actor', async () => {
    const original = structuredClone(sale);
    const result = await processRefund({ ...request(), totalRefunded: 10000, receiptNo: 'forged', refundedBy: 'Owner', items: [{ originalIndex: 0, quantity: 1, price: 10000 }] }, actor);
    assert.equal(result.refund.totalRefunded, 80);
    assert.equal(result.refund.discount, 20);
    assert.equal(result.refund.receiptNo, original.receiptNo);
    assert.equal(result.refund.refundedByEmail, actor.email);
    assert.equal(result.refund.status, 'completed');
    assert.deepEqual({ ...sale, refundVersion: 0 }, original);
    assert.equal(audits[0].changes.stockReturned, false);
    const [view] = await annotateRefunds([sale]);
    assert.equal(view.refundSummary.totalRefunded, 80);
    assert.equal(view.items[0].refundableQuantity, 2);
    assert.equal(view.items[0].activeQuantity, 2);
});

test('separate variants of the same product use their original line index and original payment method', async () => {
    sale.paymentMethod = 'GCash';
    const result = await processRefund({ ...request([{ originalIndex: 1, quantity: 1 }]), paymentMethod: 'Cash' }, actor);
    assert.equal(result.refund.totalRefunded, 100);
    assert.equal(result.refund.items[0].name, 'Coffee Large');
    assert.equal(result.refund.paymentMethod, 'GCash');
    assert.equal(refundView(sale, refunds).items[0].refundableQuantity, 3);
});

test('partial refunds add up exactly to the paid amount, including centavos', async () => {
    sale = { ...sale, subtotal: 100, discount: 0, total: 100, discountInfo: {}, items: [{ name: 'Set', quantity: 3, price: 100 / 3, subtotal: 100 }] };
    const amounts = [];
    for (let i = 0; i < 3; i++) amounts.push((await processRefund(request(undefined, `request_rounding_${i}`), actor)).refund.totalRefunded);
    assert.deepEqual(amounts, [33.33, 33.34, 33.33]);
    assert.equal(refundView(sale, refunds).refundSummary.canRefund, false);
    await assert.rejects(processRefund(request(undefined, 'request_rounding_4'), actor), /no remaining amount/);
});

test('concurrent overlapping refunds cannot refund a quantity twice; repeat requests are idempotent', async () => {
    const body = request([{ originalIndex: 0, quantity: 3 }]);
    const results = await Promise.allSettled([processRefund(body, actor), processRefund({ ...body, requestId: 'request_concurrent2' }, actor)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(refunds.length, 1);
    assert.equal((await processRefund(body, actor)).replayed, true);
    assert.equal(refunds.length, 1);
    await assert.rejects(processRefund({ ...body, reason: 'Different reason' }, actor), /already used/);
});

test('invalid, empty, duplicate, fractional and excessive quantities do not write refunds', async () => {
    for (const items of [[], [{ originalIndex: 0, quantity: -1 }], [{ originalIndex: 0, quantity: 0.5 }], [{ originalIndex: 999, quantity: 1 }], [{ originalIndex: 0, quantity: 4 }], [{ originalIndex: 0, quantity: 1 }, { originalIndex: 0, quantity: 1 }]]) {
        await assert.rejects(processRefund(request(items), actor));
    }
    await assert.rejects(processRefund({ ...request(), reason: '  ' }, actor));
    assert.equal(refunds.length, 0); assert.equal(sale.refundVersion, 0);
});

test('refund reasons accept 150 characters and reject longer direct API input without saving', async () => {
    await assert.rejects(processRefund({ ...request(), reason: 'x'.repeat(151) }, actor), error => error.status === 400 && /150 characters/.test(error.message));
    assert.equal(refunds.length, 0);
    const result = await processRefund({ ...request(), reason: 'x'.repeat(150) }, actor);
    assert.equal(result.refund.reason.length, 150);
});

test('cancelled, unpaid, active and unknown sales cannot be refunded; permissions are required', async () => {
    for (const status of ['pending', 'preparing', 'ready', 'cancelled']) {
        sale.orderStatus = status;
        await assert.rejects(processRefund(request(), actor), /Only completed paid/);
    }
    sale.orderStatus = 'completed'; sale.paymentMethod = 'Cancelled';
    await assert.rejects(processRefund(request(), actor), /Only completed paid/);
    await assert.rejects(processRefund(request(), { ...actor, permissions: ['items'] }), error => error.status === 403);
    await assert.rejects(processRefund({ ...request(), transactionId: '123456789012345678901239' }, actor), error => error.status === 404);
});

test('refund, sale version and audit are rolled back together if saving fails', async () => {
    mock.method(SystemAudit, 'create', async () => { throw new Error('Audit unavailable'); });
    await assert.rejects(processRefund(request(), actor), /Audit unavailable/);
    assert.equal(sale.refundVersion, 0); assert.equal(refunds.length, 0);
});

test('legacy refunds reserve quantities, rejected refunds do not, and linked cancellations are counted once', () => {
    sale.cancelledItems = [{ originalIndex: 0, quantity: 1, refundId: 'legacy' }];
    const view = refundView(sale, [
        { _id: 'legacy', status: 'completed', totalRefunded: 80, items: [{ productId: sale.items[0].productId, quantity: 1 }] },
        { _id: 'pending', status: 'pending', totalRefunded: 80, items: [{ originalIndex: 0, quantity: 1 }] },
        { status: 'rejected', totalRefunded: 80, items: [{ originalIndex: 0, quantity: 1 }] },
    ]);
    assert.equal(view.items[0].refundedQuantity, 1);
    assert.equal(view.items[0].reservedRefundQuantity, 1);
    assert.equal(view.items[0].refundableQuantity, 1);
    assert.equal(view.refundSummary.remainingAmount, 180);
});
