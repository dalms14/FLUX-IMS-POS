const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isStaffReceiver, canReceiveOrder } = require('../utils/purchaseOrderReceiver');
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
