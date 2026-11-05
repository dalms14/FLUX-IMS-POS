const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeHistory, getInventoryHistory, recordSaleUsage, dateBounds } = require('../services/inventoryHistory');
const SystemAudit = require('../models/SystemAudit');
const Waste = require('../models/Waste');
const PurchaseOrder = require('../models/PurchaseOrder');
const orderId = '123456789012345678901234';

test('approved PO deliveries include every ingredient, its unit, approver and reference, while pending arrivals do not change stock', () => {
    const logs = [
        { _id: 'approved', module: 'Purchase Orders', action: 'Delivery Received', entityId: orderId, entityName: 'PO-TEST-001', actor: 'Finance', createdAt: '2026-11-05T04:00:00Z', changes: { receivedBy: 'Staff', items: [{ name: 'Coffee Beans', quantity: 1000 }, { name: 'Milk', quantity: 500, unit: 'ml' }] } },
        { _id: 'arrival', module: 'Purchase Orders', action: 'Arrival Reported', changes: { items: [{ name: 'Sugar', quantity: 200 }] } },
    ];
    const orders = [{ _id: orderId, items: [{ name: 'Coffee Beans', unit: 'g' }, { name: 'Milk', unit: 'ml' }] }];
    const rows = normalizeHistory(logs, [], orders);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].quantity, '1,000 g');
    assert.equal(rows[0].by, 'Finance');
    assert.equal(rows[0].receivedBy, 'Staff');
    assert.equal(rows[0].reference, 'PO-TEST-001');
    assert.ok(rows.every(row => row.movementType === 'received' && row.direction === 'in'));
});

test('expiration, adjustment, sale usage and refund waste remain separate, with one unit per row', () => {
    const rows = normalizeHistory([
        { _id: 'expired', module: 'Inventory', action: 'Expired Stock Auto Deducted', createdAt: '2026-11-05', entityName: 'Milk', changes: { quantity: 5000, oldStock: 100, newStock: 0, unit: 'ml' } },
        { _id: 'out', module: 'Inventory', action: 'Stock Out', createdAt: '2026-11-04', entityName: 'Flour', changes: { quantity: 10, unit: 'g' } },
        { _id: 'sale', module: 'Inventory', action: 'Sale Deduction', createdAt: '2026-11-03', entityName: 'Beans', changes: { quantity: 18, unit: 'g', receiptNo: 'FLX-TEST' } },
    ], [{ _id: 'waste', createdAt: '2026-11-02', receiptNo: 'FLX-OLD', disposedBy: 'Staff', items: [{ inventoryName: 'Cream', amountWasted: 20.125, unit: 'g' }, { inventoryName: 'Syrup', amountWasted: 10, unit: 'ml' }] }]);
    assert.deepEqual(rows.map(row => row.movementType), ['expired', 'adjustment', 'sale', 'waste', 'waste']);
    assert.equal(rows[0].amount, 100); // Actual stock change, not the oversized expired batch.
    assert.equal(rows[2].reference, 'FLX-TEST');
    assert.equal(rows[3].quantity, '20.125 g');
    assert.equal(rows[4].quantity, '10 ml');
    assert.equal(new Set(rows.map(row => row._id)).size, rows.length);
    assert.ok(rows.every(row => row.direction === 'out'));
});

test('history date ranges use Philippine calendar days and reject reversed dates', () => {
    const range = dateBounds('2026-11-05', '2026-11-05');
    assert.equal(range.createdAt.$gte.toISOString(), '2026-11-04T16:00:00.000Z');
    assert.equal(range.createdAt.$lte.toISOString(), '2026-11-05T15:59:59.999Z');
    assert.throws(() => dateBounds('2026-11-11', '2026-11-03'), error => error.status === 400);
    assert.throws(() => dateBounds('invalid', ''), error => error.status === 400);
});

test('history queries receipt-completion audits once and looks up old purchase-order units', async t => {
    let filter;
    t.mock.method(SystemAudit, 'find', value => { filter = value; return { sort() { return this; }, lean: async () => [
        { _id: 'legacy', module: 'Purchase Orders', action: 'Stock Received', entityId: orderId, entityName: 'PO-OLD', createdAt: '2026-11-05', changes: { receivedItems: [{ name: 'Beans', quantity: 50 }] } },
    ] }; });
    t.mock.method(Waste, 'find', () => ({ populate() { return this; }, sort() { return this; }, lean: async () => [] }));
    t.mock.method(PurchaseOrder, 'find', value => {
        assert.deepEqual(value, { _id: { $in: [orderId] } });
        return { select() { return this; }, lean: async () => [{ _id: orderId, items: [{ name: 'Beans', unit: 'g' }] }] };
    });
    const rows = await getInventoryHistory();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].quantity, '50 g');
    assert.deepEqual(filter.$or[1].action.$in, ['Stock Received', 'Delivery Received']);
});

test('sale usage records saved receipt identity and exact consumed amounts, without risking a completed sale on audit failure', async t => {
    let events;
    t.mock.method(SystemAudit, 'insertMany', async rows => { events = rows; });
    await recordSaleUsage({ _id: 'sale', receiptNo: 'FLX-001', cashier: 'Staff', cashierEmail: 'staff@example.com' }, [{ inventoryId: 'beans', name: 'Coffee Beans', required: 36, unit: 'g' }]);
    assert.equal(events[0].action, 'Sale Deduction');
    assert.equal(events[0].changes.quantity, 36);
    assert.equal(events[0].changes.receiptNo, 'FLX-001');
    assert.equal(events[0].actorEmail, 'staff@example.com');
    const log = t.mock.method(console, 'error', () => {});
    t.mock.method(SystemAudit, 'insertMany', async () => { throw new Error('Unavailable'); });
    await assert.doesNotReject(recordSaleUsage({ _id: 'sale' }, [{ inventoryId: 'beans', required: 36 }]));
    assert.equal(log.mock.callCount(), 1);
});
