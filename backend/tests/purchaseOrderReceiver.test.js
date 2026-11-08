const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isStaffReceiver, isAssignableReceiver, canReceiveOrder } = require('../utils/purchaseOrderReceiver');
const order = email => ({ assignedReceiver: { email } });

test('staff-only orders exclude admins and owners, including approvers', () => {
    for (const role of ['admin', 'owner', 'custom']) {
        const user = { email: 'admin@elicoffee.com', userId: 'ELI001', role };
        assert.equal(isStaffReceiver(user), false);
        assert.equal(canReceiveOrder(order('__any_staff__'), user), false);
    }
    assert.equal(canReceiveOrder(order('__any_staff__'), { role: 'Staff' }), true);
});

test('everyone and specific staff assignments keep their own receiving rules', () => {
    assert.equal(canReceiveOrder(order('__anyone__'), { role: 'admin' }), true);
    assert.equal(canReceiveOrder(order('staff@example.com'), { email: 'STAFF@example.com' }), true);
    assert.equal(canReceiveOrder(order('staff@example.com'), { email: 'other@example.com', role: 'owner' }), false);
    assert.equal(canReceiveOrder(order('__anyone__'), { archived: true, role: 'staff' }), false);
    assert.equal(canReceiveOrder(order('__anyone__'), null), false);
});

test('custom staff roles such as Operations can receive staff assignments; admin and owner roles cannot', () => {
    const operations = { role: 'custom', jobRole: 'operations', email: 'operations@example.com' };
    assert.equal(isStaffReceiver(operations), true);
    assert.equal(canReceiveOrder(order('__any_staff__'), operations), true);
    assert.equal(canReceiveOrder(order(operations.email), operations), true);
    for (const role of ['admin', 'owner']) assert.equal(isStaffReceiver({ role, email: 'other@example.com' }), false);
});

test('admins can be assigned individually and receive only their own specific deliveries', () => {
    const admin = { role: 'Admin', email: 'admin@example.com' };
    assert.equal(isAssignableReceiver(admin), true);
    assert.equal(canReceiveOrder(order(admin.email), admin), true);
    assert.equal(canReceiveOrder(order('other@example.com'), admin), false);
    assert.equal(canReceiveOrder(order('__any_staff__'), admin), false);
    assert.equal(isAssignableReceiver({ ...admin, archived: true }), false);
    assert.equal(isAssignableReceiver({ ...admin, role: 'owner' }), false);
    assert.equal(isAssignableReceiver({ ...admin, userId: 'ELI001' }), false);
});
