const { test, before, after, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AuthSession = require('../models/AuthSession');
const SecurityAttempt = require('../models/SecurityAttempt');
const Inventory = require('../models/Inventory');
const PurchaseOrder = require('../models/PurchaseOrder');
const LoginActivity = require('../models/LoginActivity');
const EmailVerification = require('../models/EmailVerification');
const SystemAudit = require('../models/SystemAudit');
const Notification = require('../models/Notification');
const crypto = require('crypto');
const { issueSession } = require('../services/authSessions');
const app = require('../server');
let server, base, users, sessions, attempts;
const query = value => ({ then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }, select() { return this; }, lean: async () => value });
before(async () => {
    server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); });
beforeEach(async () => {
    const password = await bcrypt.hash('ValidSecret123', 4);
    users = ['owner', 'staff', 'admin', 'custom'].map((role, index) => ({ _id: `account${index}`, email: `${role}@example.com`, name: role, role, userId: `TEST${index}`, jobRole: role === 'custom' ? 'Finance' : '', password, async save() {} }));
    sessions = new Map(); attempts = new Map();
    mock.method(User, 'findById', id => query(users.find(user => user._id === String(id))));
    mock.method(User, 'findOne', filter => query(users.find(user => user.email === filter.email && (!filter.archived || !user.archived))));
    mock.method(AuthSession, 'create', async data => { const row = { ...data, _id: data.tokenHash }; sessions.set(data.tokenHash, row); return row; });
    mock.method(AuthSession, 'findOne', async filter => { const row = sessions.get(filter.tokenHash); return row && row.expiresAt > filter.expiresAt.$gt ? row : null; });
    mock.method(AuthSession, 'updateOne', async (filter, update) => {
        const row = sessions.get(filter._id);
        if (!row || row.expiresAt <= filter.expiresAt.$gt) return { matchedCount: 0 };
        if (update.$max.lastActivityAt > row.lastActivityAt) Object.assign(row, update.$max);
        return { matchedCount: 1 };
    });
    mock.method(AuthSession, 'deleteOne', async filter => { sessions.delete(filter._id); });
    mock.method(SecurityAttempt, 'findOneAndUpdate', async filter => { const count = (attempts.get(filter.key) || 0) + 1; attempts.set(filter.key, count); return { count }; });
    mock.method(LoginActivity, 'create', async () => ({}));
    mock.method(SystemAudit, 'create', async () => ({}));
    mock.method(Inventory, 'find', () => ({ ...query([]), sort: async () => [] }));
});
afterEach(() => mock.restoreAll());
const request = async (path, { token, body, method = 'GET', activity } = {}) => {
    const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(activity ? { 'X-Session-Activity': String(activity) } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
};

test('profile activity and last sign-in are scoped to the signed-in account and expose no credentials', async () => {
    const Transaction = require('../models/Transaction');
    const Refund = require('../models/Refund');
    const filters = {};
    const chain = value => ({ sort() { return this; }, limit() { return this; }, select() { return this; }, lean: async () => value, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
    mock.method(Transaction, 'find', filter => { filters.sales = filter; return chain([]); });
    mock.method(Refund, 'find', filter => { filters.refunds = filter; return chain([]); });
    mock.method(LoginActivity, 'findOne', filter => { filters.login = filter; return chain({ createdAt: '2026-11-06T00:00:00Z' }); });
    const token = await issueSession(users[1]);
    const response = await request('/auth/my-activity?email=owner@example.com', { token });
    assert.equal(response.status, 200);
    assert.deepEqual(filters.sales, { cashierEmail: users[1].email });
    assert.deepEqual(filters.refunds, { refundedByEmail: users[1].email });
    assert.deepEqual(filters.login, { userId: users[1]._id, action: 'login' });
    assert.equal(response.data.user.email, users[1].email);
    assert.equal(response.data.user.password, undefined);
    assert.equal(response.data.lastSignInAt, '2026-11-06T00:00:00Z');
});

test('business APIs reject absent and forged sessions regardless of claimed owner email or role', async () => {
    for (const path of ['/inventory', '/products', '/auth/users', '/purchase-orders', '/transactions', '/refunds', '/elite-members']) {
        assert.equal((await request(path)).status, 401);
        assert.equal((await request(path, { token: 'a'.repeat(64) })).status, 401);
    }
    assert.equal((await request('/auth/users', { method: 'POST', body: { currentUserEmail: 'owner@example.com', role: 'owner' } })).status, 401);
});

test('normal login issues an opaque token accepted by authorized APIs; staff permissions still restrict inventory editing', async () => {
    const login = await request('/auth/login', { method: 'POST', body: { email: users[0].email, password: 'ValidSecret123' } });
    assert.equal(login.status, 200);
    assert.match(login.data.sessionToken, /^[a-f0-9]{64}$/);
    assert.equal((await request('/inventory', { token: login.data.sessionToken })).status, 200);
    const staff = await issueSession(users[1]);
    assert.equal((await request('/inventory', { method: 'POST', token: staff, body: { currentUserEmail: users[0].email, name: 'Fake stock' } })).status, 403);
});

test('archiving, password replacement and missing records invalidate server sessions', async () => {
    let token = await issueSession(users[0]);
    users[0].archived = true;
    assert.equal((await request('/inventory', { token })).data.code, 'ACCOUNT_INACTIVE');
    users[0].archived = false;
    token = await issueSession(users[0]);
    users[0].password = 'replacement-hash';
    assert.equal((await request('/inventory', { token })).data.code, 'ACCOUNT_INACTIVE');
    token = await issueSession(users[0]);
    sessions.clear();
    assert.equal((await request('/inventory', { token })).status, 401);
});

test('off-shift staff cannot obtain a session or bypass shift editing authorization', async () => {
    const today = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'long' }).format(new Date()).toLowerCase();
    const workday = today === 'monday' ? 'friday' : 'monday';
    users[1].shiftSchedule = { workdays: [workday], startTime: '08:00', endTime: '17:00', restrictLogin: true, earlyLoginMinutes: 0, timeZone: 'Asia/Manila' };
    const result = await request('/auth/login', { method: 'POST', body: { email: users[1].email, password: 'ValidSecret123' } });
    assert.equal(result.status, 403);
    assert.equal(result.data.code, 'OUTSIDE_SHIFT');
    assert.equal(result.data.sessionToken, undefined);
    const staffSession = await issueSession(users[1]);
    assert.equal((await request('/auth/users/507f1f77bcf86cd799439011/shift', { method: 'PUT', body: { shiftSchedule: users[1].shiftSchedule } })).status, 401);
    assert.equal((await request('/auth/users/507f1f77bcf86cd799439011/shift', { token: staffSession, method: 'PUT', body: { shiftSchedule: users[1].shiftSchedule } })).status, 403);
});

test('heartbeat does not extend idle time, fresh input does, and an expired token cannot be revived', async () => {
    const token = await issueSession(users[0]);
    const row = [...sessions.values()][0];
    row.lastActivityAt = new Date(Date.now() - 60000);
    row.expiresAt = new Date(Date.now() + 30000);
    const expires = row.expiresAt.getTime();
    // Use a permitted read to exercise the shared authentication boundary without background input.
    assert.equal((await request('/inventory', { token })).status, 200);
    assert.equal(row.expiresAt.getTime(), expires);
    assert.equal((await request('/inventory', { token, activity: Date.now() })).status, 200);
    assert.ok(row.expiresAt.getTime() > expires);
    row.expiresAt = new Date(0);
    assert.equal((await request('/inventory', { token, activity: Date.now() })).status, 401);
});

test('personal delivery requests ignore another account email and server permissions are read fresh on every request', async () => {
    let filter;
    mock.method(PurchaseOrder, 'find', value => { filter = value; return { sort: async () => [] }; });
    const token = await issueSession(users[1]);
    assert.equal((await request('/purchase-orders/my-deliveries?email=owner@example.com', { token })).status, 200);
    assert.equal(filter['assignedReceiver.email'].$in[0], users[1].email);
    users[1].permissions = ['inventory'];
    assert.equal((await request('/inventory', { token })).status, 200);
    users[1].permissions = [];
    assert.equal((await request('/inventory', { token })).status, 403);
});

test('account creation rejects owner aliases and prevents admins from creating another admin', async () => {
    const owner = await issueSession(users[0]);
    const admin = await issueSession(users[2]);
    const body = { name: 'New account', email: 'new@example.com', password: 'Temporary123', role: 'staff', verificationCode: '123456' };
    for (const fields of [{ role: 'owner' }, { userId: 'ELI001' }, { email: 'admin@elicoffee.com' }]) {
        assert.ok([400, 403].includes((await request('/auth/users', { method: 'POST', token: owner, body: { ...body, ...fields } })).status));
    }
    assert.equal((await request('/auth/users', { method: 'POST', token: admin, body: { ...body, role: 'admin' } })).status, 403);
});

test('unprivileged delivery approval is rejected before any inventory write', async () => {
    const token = await issueSession(users[1]);
    users[1].permissions = ['purchase_orders'];
    let accessed = false;
    mock.method(PurchaseOrder, 'findById', () => { accessed = true; throw new Error('Must not access inventory/order'); });
    const result = await request('/purchase-orders/order1/pending-receipts/receipt1/approve', { method: 'POST', token, body: { actorEmail: users[0].email } });
    assert.equal(result.status, 403);
    assert.equal(accessed, false);
});

test('password confirmations share an account limit across alternative endpoints', async () => {
    const token = await issueSession(users[0]);
    let limited = false;
    for (let index = 0; index < 11; index += 1) {
        const result = await request(index % 2 ? '/auth/change-password' : '/system/backup', { method: 'POST', token,
            body: { email: users[1].email, password: 'wrong', currentPassword: 'wrong', newPassword: 'AnotherSecret123' } });
        if (result.status === 429) { limited = true; break; }
    }
    assert.equal(limited, true);
});

test('authorized owner account creation still verifies the mailbox and forces the first password change', async () => {
    const token = await issueSession(users[0]);
    mock.method(EmailVerification, 'findOne', () => query({ otpHash: crypto.createHash('sha256').update('123456').digest('hex'), expiresAt: new Date(Date.now() + 60000), attempts: 0 }));
    mock.method(EmailVerification, 'deleteOne', async () => ({}));
    let created;
    mock.method(User, 'create', async fields => { created = fields; return { ...fields, _id: 'new-user' }; });
    const result = await request('/auth/users', { method: 'POST', token, body: { name: 'New Staff', email: 'new@example.com', password: 'Temporary123', role: 'staff', userId: 'ELI099', verificationCode: '123456' } });
    assert.equal(result.status, 201);
    assert.equal(created.mustChangePassword, true);
    assert.equal(created.role, 'staff');
    assert.equal(result.data.user.password, undefined);
});

test('an authenticated Finance approver can approve a pending delivery and inventory updates through that approval only', async () => {
    const token = await issueSession(users[3]);
    const line = { _id: 'line1', inventoryId: 'stock1', name: 'Beans', unit: 'kg', orderedQuantity: 2, receivedQuantity: 0 };
    const receipt = { _id: 'receipt1', status: 'Pending Approval', reportedBy: 'Staff', arrivedAt: new Date(), items: [{ itemId: 'line1', name: 'Beans', quantity: 2 }] };
    const items = [line]; items.id = () => line;
    const pendingReceipts = [receipt]; pendingReceipts.id = () => receipt;
    const order = { _id: 'order1', purchaseOrderNo: 'PO-TEST', assignedReceiver: { name: 'Staff' }, status: 'Arrival Pending Approval', items, pendingReceipts, receipts: [], async save() {} };
    const inventory = { _id: 'stock1', unit: 'kg', stock: 0, expirationBatches: [], async save() {} };
    mock.method(PurchaseOrder, 'findById', async () => order);
    mock.method(Inventory, 'findById', async () => inventory);
    mock.method(Notification, 'updateMany', async () => ({}));
    const result = await request('/purchase-orders/order1/pending-receipts/receipt1/approve', { method: 'POST', token, body: { actorEmail: users[0].email } });
    assert.equal(result.status, 200);
    assert.equal(inventory.stock, 2);
    assert.equal(receipt.reviewedByEmail, users[3].email);
    assert.equal(order.status, 'Received');
});

test('logout revokes the same bearer token even if another email is supplied', async () => {
    const token = await issueSession(users[0]);
    mock.method(User, 'findOneAndUpdate', async filter => users.find(user => user.email === filter.email));
    assert.equal((await request('/auth/logout', { method: 'POST', token, body: { email: users[1].email } })).status, 200);
    assert.equal((await request('/inventory', { token })).status, 401);
});

test('restricted creators cannot grant implicit staff defaults or Finance/HR approval authority', async () => {
    users[2].permissions = ['staff', 'users'];
    const token = await issueSession(users[2]);
    const body = { name: 'New user', email: 'new@example.com', password: 'Temporary123', userId: 'ELI099', verificationCode: '123456' };
    for (const fields of [{ role: 'staff' }, { role: 'staff', permissions: [] }, { role: 'custom', jobRole: 'Finance', permissions: [] }, { role: 'custom', jobRole: 'HR', permissions: [] }, { role: 'custom', jobRole: 'Membership Clerk', permissions: ['elite_members'] }]) {
        const result = await request('/auth/users', { method: 'POST', token, body: { ...body, ...fields } });
        assert.equal(result.status, 403);
    }
});

test('a custom account explicitly delegated users access can create a custom account within its own authority', async () => {
    Object.assign(users[3], { jobRole: 'Operations', permissions: ['settings', 'staff', 'users'] });
    const token = await issueSession(users[3]);
    mock.method(EmailVerification, 'findOne', () => query({ otpHash: crypto.createHash('sha256').update('123456').digest('hex'), expiresAt: new Date(Date.now() + 60000), attempts: 0 }));
    mock.method(EmailVerification, 'deleteOne', async () => ({}));
    mock.method(User, 'create', async fields => ({ ...fields, _id: 'new-user' }));
    const result = await request('/auth/users', { method: 'POST', token, body: { name: 'Assistant', email: 'new@example.com', password: 'Temporary123', userId: 'ELI099', verificationCode: '123456', role: 'custom', jobRole: 'Assistant', permissions: ['settings'] } });
    assert.equal(result.status, 201);
    assert.deepEqual(result.data.user.permissions, ['settings']);
});

test('owner can create a custom membership-only role and the new permission is retained', async () => {
    const token = await issueSession(users[0]);
    mock.method(EmailVerification, 'findOne', () => query({ otpHash: crypto.createHash('sha256').update('123456').digest('hex'), expiresAt: new Date(Date.now() + 60000), attempts: 0 }));
    mock.method(EmailVerification, 'deleteOne', async () => ({}));
    mock.method(User, 'create', async fields => ({ ...fields, _id: 'new-user' }));
    const result = await request('/auth/users', { method: 'POST', token, body: { name: 'Member Clerk', email: 'new@example.com', password: 'Temporary123', userId: 'ELI099', verificationCode: '123456', role: 'custom', jobRole: 'Membership Clerk', permissions: ['elite_members'] } });
    assert.equal(result.status, 201);
    assert.deepEqual(result.data.user.permissions, ['elite_members']);
});

test('owner can grant and revoke Elite Membership on an existing custom account', async () => {
    const token = await issueSession(users[0]);
    const target = users[3];
    mock.method(User, 'findOne', () => query(users[0]));
    for (const permissions of [['elite_members'], []]) {
        const result = await request('/auth/users/' + target._id + '/access', { method: 'PUT', token, body: { permissions } });
        assert.equal(result.status, 200);
        assert.deepEqual(target.permissions, permissions);
        assert.deepEqual(result.data.user.permissions, permissions);
    }
});

test('Create Accounts without Users cannot request verification or create accounts through the API', async () => {
    Object.assign(users[3], { jobRole: 'Operations', permissions: ['users'] });
    const token = await issueSession(users[3]);
    for (const path of ['/auth/users/verification/request', '/auth/users']) {
        assert.equal((await request(path, { method: 'POST', token, body: { email: 'new@example.com' } })).status, 403);
    }
});

test('owner access updates remove Create Accounts unless Users is included', async () => {
    const token = await issueSession(users[0]);
    mock.method(User, 'findOne', () => query(users[0]));
    for (const [permissions, expected] of [[['staff', 'users'], ['staff', 'users']], [['dashboard', 'users'], ['dashboard']]]) {
        const result = await request('/auth/users/' + users[3]._id + '/access', { method: 'PUT', token, body: { permissions } });
        assert.equal(result.status, 200);
        assert.deepEqual(result.data.user.permissions, expected);
        assert.deepEqual(users[3].permissions, expected);
    }
});

test('account creation removes Create Accounts when the submitted custom role has no Users access', async () => {
    const token = await issueSession(users[0]);
    mock.method(EmailVerification, 'findOne', () => query({ otpHash: crypto.createHash('sha256').update('123456').digest('hex'), expiresAt: new Date(Date.now() + 60000), attempts: 0 }));
    mock.method(EmailVerification, 'deleteOne', async () => ({}));
    mock.method(User, 'create', async fields => ({ ...fields, _id: 'new-user' }));
    const result = await request('/auth/users', { method: 'POST', token, body: { name: 'Assistant', email: 'new@example.com', password: 'Temporary123', userId: 'ELI099', verificationCode: '123456', role: 'custom', jobRole: 'Assistant', permissions: ['dashboard', 'users'] } });
    assert.equal(result.status, 201);
    assert.deepEqual(result.data.user.permissions, ['dashboard']);
});

test('dated log exports paginate all matching records using stable ordering and Philippine date bounds', async () => {
    const token = await issueSession(users[0]);
    for (const [path, model] of [['/system-audit', SystemAudit], ['/auth/login-activity', LoginActivity]]) {
        const logs = Array.from({ length: 503 }, (_, index) => ({ _id: String(index), name: 'Log ' + index }));
        mock.method(model, 'find', filter => {
            assert.equal(filter.createdAt.$gte.toISOString(), '2026-10-02T16:00:00.000Z');
            assert.equal(filter.createdAt.$lte.toISOString(), '2026-10-03T15:59:59.999Z');
            let offset = 0, count;
            return { sort(order) { assert.deepEqual(order, { createdAt: -1, _id: -1 }); return this; }, skip(value) { offset = value; return this; }, limit(value) { count = value; return this; }, lean: async () => logs.slice(offset, offset + count) };
        });
        const period = '?startDate=2026-10-03T00%3A00%3A00%2B08%3A00&endDate=2026-10-03T23%3A59%3A59.999%2B08%3A00';
        const first = await request(path + period + '&page=1', { token });
        assert.equal(first.status, 200);
        assert.equal(first.data.data.length, 500);
        assert.equal(first.data.hasMore, true);
        const second = await request(path + period + '&page=2', { token });
        assert.equal(second.data.data.length, 3);
        assert.equal(second.data.hasMore, false);
        assert.equal(second.data.data[0]._id, '500');
        assert.equal((await request(path + period + '&page=0', { token })).status, 400);
    }
});

test('an archived administrator cannot archive another account using an old session and password', async () => {
    const token = await issueSession(users[2]);
    users[2].archived = true;
    const result = await request('/auth/users/someone-else', { method: 'DELETE', token, body: { currentUserEmail: users[2].email, password: 'ValidSecret123' } });
    assert.equal(result.status, 403);
    assert.equal(result.data.code, 'ACCOUNT_INACTIVE');
});

test('refund HTTP workflow binds the actor, keeps the sale, updates refund history and net product quantities', async () => {
    const mongoose = require('mongoose');
    const Transaction = require('../models/Transaction');
    const Refund = require('../models/Refund');
    const saleId = '123456789012345678901234';
    const sale = { _id: saleId, receiptNo: 'FLX-TEST-REFUND', orderStatus: 'completed', paymentMethod: 'Cash', refundVersion: 0,
        subtotal: 200, discount: 40, tax: 0, total: 160, createdAt: new Date(),
        items: [{ name: 'Coffee', productId: '123456789012345678901230', quantity: 2, price: 100, subtotal: 200 }] };
    const rows = [];
    const chain = value => ({ session() { return this; }, select() { return this; }, populate() { return this; }, sort() { return this; }, lean: async () => structuredClone(value()) });
    mock.method(mongoose, 'startSession', async () => ({ withTransaction: async fn => fn(), endSession: async () => {} }));
    mock.method(Transaction, 'findById', () => chain(() => sale));
    mock.method(Transaction, 'find', () => chain(() => [sale]));
    mock.method(Transaction, 'updateOne', async () => { sale.refundVersion++; return { matchedCount: 1 }; });
    mock.method(Refund, 'find', () => chain(() => rows));
    mock.method(Refund, 'create', async ([row]) => { const saved = { ...row, _id: 'refund1' }; rows.push(saved); return [saved]; });
    const token = await issueSession(users[1]);
    const body = { transactionId: saleId, requestId: 'request_http_0123456789', reason: 'Wrong order', items: [{ originalIndex: 0, quantity: 1, price: 99999 }], refundedBy: 'Owner', refundedByEmail: users[0].email };
    assert.equal((await request('/refunds', { method: 'POST', body })).status, 401);
    const saved = await request('/refunds', { method: 'POST', token, body });
    assert.equal(saved.status, 201);
    assert.equal(saved.data.data.refundedByEmail, users[1].email);
    assert.equal(saved.data.data.totalRefunded, 80);
    assert.equal(sale.total, 160);
    const detail = await request(`/transactions/${saleId}`, { token });
    assert.equal(detail.data.data.refundSummary.remainingAmount, 80);
    assert.equal(detail.data.data.items[0].refundableQuantity, 1);
    const history = await request('/refunds', { token });
    assert.equal(history.data.data[0].totalRefunded, 80);
    const sales = await request('/sales-history', { token });
    assert.equal(sales.data.summary.totalQty, 1);
    assert.equal((await request('/refunds', { method: 'POST', token, body })).status, 200);
    assert.equal(rows.length, 1);
    users[1].permissions = ['items'];
    assert.equal((await request('/refunds', { method: 'POST', token, body })).status, 403);
});

test('product create and update both reject invalid variant price add-ons before database writes', async () => {
    const token = await issueSession(users[0]);
    for (const [method, path] of [['POST', '/products'], ['PUT', '/products/123456789012345678901234']]) {
        for (const price of [10000, -1, 1.234]) {
            const result = await request(path, { method, token, body: { name: 'Coffee', category: 'Drinks', soloPrice: 100, variantGroups: [{ name: 'Size', options: ['Large'], optionPrices: [price] }] } });
            assert.equal(result.status, 400);
            assert.equal(result.data.code, 'INVALID_VARIANT_PRICE');
        }
    }
});

test('recipe API saves canonical option ingredients, rejects invalid amounts and preserves rules for legacy clients', async () => {
    const Product = require('../models/Product');
    const Recipe = require('../models/Recipe');
    const id = '123456789012345678901234';
    mock.method(Product, 'findById', () => query({ _id: id, name: 'Coffee', variantGroups: [{ name: 'Size', options: ['Large'] }] }));
    mock.method(Inventory, 'find', () => query([{ _id: id, name: 'Beans', unit: 'g' }]));
    let written;
    mock.method(Recipe, 'findOneAndUpdate', async (_, fields) => { written = fields; return fields; });
    const token = await issueSession(users[0]);
    const body = { ingredients: [{ inventoryId: id, amountPerServing: 18 }], optionRules: [{ mode: 'replace', conditions: [{ type: 'variant', group: 'Size', option: 'Large' }], ingredients: [{ inventoryId: id, amountPerServing: 24 }] }] };
    assert.equal((await request(`/products/${id}/recipe`, { method: 'PUT', token, body })).status, 200);
    assert.equal(written.optionRules[0].ingredients[0].unit, 'g');
    assert.equal(written.optionRules[0].ingredients[0].amountPerServing, 24);
    assert.equal((await request(`/products/${id}/recipe`, { method: 'PUT', token, body: { ingredients: [] } })).status, 200);
    assert.equal(Object.hasOwn(written, 'optionRules'), false);
    written = null;
    body.optionRules[0].ingredients[0].amountPerServing = -1;
    const invalid = await request(`/products/${id}/recipe`, { method: 'PUT', token, body });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.data.code, 'INVALID_RECIPE');
    assert.equal(written, null);
});

test('checkout checks option-specific requirements and rejects shortage without recording a sale or consuming stock', async () => {
    const Product = require('../models/Product');
    const Recipe = require('../models/Recipe');
    const Transaction = require('../models/Transaction');
    const id = '123456789012345678901234';
    mock.method(Product, 'findById', () => query({ _id: id, name: 'Coffee', soloPrice: 100, category: 'Drinks', variantGroups: [{ name: 'Size', options: ['Large'], optionPrices: [0] }] }));
    mock.method(Recipe, 'findOne', () => query({ ingredients: [{ inventoryId: id, name: 'Beans', unit: 'g', amountPerServing: 18 }], optionRules: [{ mode: 'replace', conditions: [{ type: 'variant', group: 'Size', option: 'Large' }], ingredients: [{ inventoryId: id, name: 'Beans', unit: 'g', amountPerServing: 24 }] }] }));
    mock.method(Inventory, 'find', () => query([{ _id: id, name: 'Beans', unit: 'g', stock: 40, expirationBatches: [] }]));
    let writes = 0;
    mock.method(Inventory, 'findOneAndUpdate', async () => { writes++; });
    mock.method(Transaction, 'create', async () => { writes++; });
    const token = await issueSession(users[1]);
    const result = await request('/transactions', { method: 'POST', token, body: { paymentMethod: 'Cash', amountTendered: 200, items: [{ productId: id, quantity: 2, price: 100, size: 'solo', selectedVariantGroups: { Size: 'Large' }, inventoryUsageRecorded: true, inventoryUsage: [] }] } });
    assert.equal(result.status, 409);
    assert.equal(result.data.shortages[0].required, 48);
    assert.equal(result.data.shortages[0].available, 40);
    assert.equal(writes, 0);
});

test('checkout allows low stock with enough ingredients and identifies unit mismatch separately from archiving', async () => {
    const Product = require('../models/Product');
    const Recipe = require('../models/Recipe');
    const Transaction = require('../models/Transaction');
    const id = '123456789012345678901234';
    let saves = 0, sales = 0;
    const ingredient = { _id: id, name: 'Chicken', unit: 'pcs', stock: 500, lowStockAt: 800, archived: false, expirationBatches: [], async save() { saves++; } };
    mock.method(Product, 'findById', () => query({ _id: id, name: 'Chicken Meal', soloPrice: 100 }));
    mock.method(Recipe, 'findOne', () => query({ ingredients: [{ inventoryId: id, name: 'Chicken', unit: 'g', amountPerServing: 440 }] }));
    mock.method(Inventory, 'find', () => query([ingredient]));
    mock.method(Inventory, 'findById', async () => ingredient);
    mock.method(Transaction, 'find', () => query([]));
    mock.method(Transaction, 'exists', async () => false);
    mock.method(Transaction, 'create', async fields => { sales++; return { ...fields, _id: id }; });
    mock.method(SystemAudit, 'insertMany', async () => []);
    const token = await issueSession(users[1]);
    const checkout = () => request('/transactions', { method: 'POST', token, body: { paymentMethod: 'Cash', amountTendered: 100, items: [{ productId: id, quantity: 1, size: 'solo' }] } });
    const mismatch = await checkout();
    assert.equal(mismatch.status, 400);
    assert.equal(mismatch.data.code, 'INVALID_RECIPE');
    assert.match(mismatch.data.message, /Chicken uses g in the recipe, but inventory uses pcs/);
    assert.doesNotMatch(mismatch.data.message, /archived/);
    assert.equal(saves, 0);
    assert.equal(sales, 0);
    ingredient.unit = 'g';
    ingredient.archived = true;
    const archived = await checkout();
    assert.equal(archived.status, 400);
    assert.match(archived.data.message, /Chicken is archived/);
    assert.equal(saves, 0);
    ingredient.archived = false;
    const allowed = await checkout();
    assert.equal(allowed.status, 200);
    assert.equal(ingredient.stock, 60);
    assert.equal(saves, 1);
    assert.equal(sales, 1);
});
