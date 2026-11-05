const { test } = require('node:test');
const assert = require('node:assert/strict');
const router = require('../Routes/purchaseOrderRoutes');
const User = require('../models/User');
const PurchaseOrder = require('../models/PurchaseOrder');
const SystemAudit = require('../models/SystemAudit');

async function post(path, body, params = {}) {
    const route = router.stack.find(layer => layer.route?.path === path && layer.route.methods.post).route.stack[0].handle;
    const result = { status: 200 };
    await route({ body, params }, { status(code) { result.status = code; return this; }, json(data) { result.data = data; } });
    return result;
}

test('creating a specific staff assignment rejects admin, owner and archived accounts on the server', async t => {
    let receiver;
    t.mock.method(User, 'findOne', async () => receiver);
    const create = t.mock.method(PurchaseOrder, 'create', async () => { throw new Error('Must not create'); });
    for (const account of [{ role: 'admin' }, { role: 'owner' }, { role: 'staff', archived: true }]) {
        receiver = account;
        const result = await post('/', { supplierName: 'Supplier', assignedReceiverEmail: 'test@example.com', items: [{ name: 'Beans', unit: 'kg', orderedQuantity: 2 }] });
        assert.equal(result.status, 400);
        assert.match(result.data.message, /active staff/);
    }
    assert.equal(create.mock.callCount(), 0);
});

test('an owner cannot bypass Any Staff receiving through the arrival endpoint', async t => {
    t.mock.method(User, 'findOne', async () => ({ role: 'owner', email: 'admin@elicoffee.com', userId: 'ELI001' }));
    let saved = false;
    t.mock.method(PurchaseOrder, 'findById', async () => ({ status: 'Approved', assignedReceiver: { email: '__any_staff__', name: 'Any Staff' }, save: async () => { saved = true; } }));
    const result = await post('/:id/record-arrival', { actorEmail: 'admin@elicoffee.com', items: [{ itemId: 'item1', quantity: 2 }] }, { id: 'po1' });
    assert.equal(result.status, 403);
    assert.equal(saved, false);
});

test('a purchase order can be assigned to the exact custom Operations account', async t => {
    const receiver = { _id: 'operations-id', role: 'custom', jobRole: 'operations', name: 'Athan Scott Saroca', email: 'operations@example.com' };
    t.mock.method(User, 'findOne', async () => receiver);
    t.mock.method(PurchaseOrder, 'countDocuments', async () => 0);
    t.mock.method(PurchaseOrder, 'create', async data => ({ ...data, _id: 'po1' }));
    t.mock.method(SystemAudit, 'create', async () => ({}));
    const result = await post('/', { supplierName: 'Supplier', assignedReceiverEmail: receiver.email, items: [{ name: 'Beans', unit: 'kg', orderedQuantity: 2 }] });
    assert.equal(result.status, 201);
    assert.deepEqual(result.data.order.assignedReceiver, { userId: 'operations-id', name: 'Athan Scott Saroca', email: receiver.email });
});

test('delivery lookup checks the current account and includes staff-shared orders for custom staff only', async t => {
    let user;
    let filter;
    const handler = router.stack.find(layer => layer.route?.path === '/my-deliveries').route.stack[0].handle;
    t.mock.method(User, 'findOne', () => ({ select: async () => user }));
    t.mock.method(PurchaseOrder, 'find', query => { filter = query; return { sort: async () => [] }; });
    for (const role of ['staff', 'custom', 'admin', 'owner']) {
        user = { role, email: 'current@example.com' };
        const result = {};
        await handler({ query: { email: 'CURRENT@example.com' } }, { json(data) { result.data = data; } });
        assert.equal(result.data.success, true);
        assert.deepEqual(filter['assignedReceiver.email'].$in, role === 'staff' || role === 'custom' ? ['current@example.com', '__anyone__', '__any_staff__'] : ['current@example.com', '__anyone__']);
        assert.deepEqual(filter.status.$in, ['Approved', 'Partially Received']);
        assert.equal(filter.expectedDeliveryDate, undefined, 'today and overdue deliveries must not be hidden by a date filter');
    }
});
