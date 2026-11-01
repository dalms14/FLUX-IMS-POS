const { test } = require('node:test');
const assert = require('node:assert/strict');
const router = require('../Routes/purchaseOrderRoutes');
const User = require('../models/User');
const PurchaseOrder = require('../models/PurchaseOrder');

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
