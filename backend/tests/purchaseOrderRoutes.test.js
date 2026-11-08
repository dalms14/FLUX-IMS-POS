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

test('creating a specific assignment rejects owners and archived staff or admins on the server', async t => {
    let receiver;
    t.mock.method(User, 'findOne', async () => receiver);
    const create = t.mock.method(PurchaseOrder, 'create', async () => { throw new Error('Must not create'); });
    for (const account of [{ role: 'owner' }, { role: 'staff', archived: true }, { role: 'admin', archived: true }, { role: 'admin', email: 'admin@elicoffee.com' }]) {
        receiver = account;
        const result = await post('/', { supplierName: 'Supplier', assignedReceiverEmail: 'test@example.com', items: [{ name: 'Beans', unit: 'kg', orderedQuantity: 2 }] });
        assert.equal(result.status, 400);
        assert.match(result.data.message, /active staff/);
    }
    assert.equal(create.mock.callCount(), 0);
});

test('a purchase order can be assigned to an active admin and saves the supplier email', async t => {
    const receiver = { _id: 'admin-id', role: 'admin', name: 'Receiving Admin', email: 'receiving@example.com' };
    t.mock.method(User, 'findOne', async () => receiver);
    t.mock.method(PurchaseOrder, 'countDocuments', async () => 0);
    t.mock.method(PurchaseOrder, 'create', async data => ({ ...data, _id: 'po1' }));
    t.mock.method(SystemAudit, 'create', async () => ({}));
    const result = await post('/', {
        supplierName: 'Supplier', supplierContact: '09171234567', supplierEmail: ' orders@supplier.com ',
        assignedReceiverEmail: receiver.email, items: [{ name: 'Beans', unit: 'kg', orderedQuantity: 2 }],
    });
    assert.equal(result.status, 201);
    assert.equal(result.data.order.supplierEmail, 'orders@supplier.com');
    assert.equal(result.data.order.supplierContact, '09171234567');
    assert.deepEqual(result.data.order.assignedReceiver, { userId: receiver._id, name: receiver.name, email: receiver.email });
    const document = new PurchaseOrder(result.data.order);
    assert.equal(document.supplierEmail, 'orders@supplier.com');
    assert.equal(document.validateSync()?.errors.supplierEmail, undefined);
});

test('supplier phone rejects non-digits and lengths other than 11 before writing an order', async t => {
    const create = t.mock.method(PurchaseOrder, 'create', async () => { throw new Error('Must not create'); });
    for (const supplierContact of ['0917123456', '091712345678', '0917abc4567', '+9171234567', '0917 1234567', '09171234567\n', 91712345678]) {
        const result = await post('/', {
            supplierName: 'Supplier', supplierContact, assignedReceiverEmail: '__any_staff__',
            items: [{ name: 'Beans', unit: 'kg', orderedQuantity: 2 }],
        });
        assert.equal(result.status, 400);
        assert.equal(result.data.message, 'Supplier phone number must be exactly 11 digits.');
    }
    assert.equal(create.mock.callCount(), 0);
});

test('supplier email is optional for existing orders and invalid addresses are rejected', async t => {
    const document = new PurchaseOrder({ supplierName: 'Supplier' });
    assert.equal(document.supplierEmail, '');
    assert.equal(document.validateSync()?.errors.supplierEmail, undefined);
    document.supplierEmail = 'invalid-address';
    assert.ok(document.validateSync().errors.supplierEmail);
    const create = t.mock.method(PurchaseOrder, 'create', async () => { throw new Error('Must not create'); });
    const result = await post('/', { supplierName: 'Supplier', supplierEmail: 'invalid-address', items: [{ name: 'Beans', unit: 'kg', orderedQuantity: 2 }] });
    assert.equal(result.status, 400);
    assert.match(result.data.message, /valid supplier email/);
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
