const { test, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const router = require('../Routes/inventoryCategoryRoutes');
const InventoryCategory = require('../models/InventoryCategory');
const Inventory = require('../models/Inventory');
const SystemAudit = require('../models/SystemAudit');
const { authorizeApi } = require('../middleware/apiSecurity');
let saved;
beforeEach(() => {
    saved = [];
    mock.method(InventoryCategory, 'find', () => ({ sort() { return this; }, lean: async () => saved }));
    mock.method(Inventory, 'distinct', async () => ['Coffee', 'Legacy Category', ' coffee ', '']);
    mock.method(InventoryCategory, 'create', async data => { const row = { ...data, _id: '123456789012345678901234' }; saved.push(row); return row; });
    mock.method(SystemAudit, 'create', async () => ({}));
});
afterEach(() => mock.restoreAll());
async function request(method, body = {}) {
    const result = { status: 200 };
    const handler = router.stack.find(layer => layer.route?.methods[method]).route.stack[0].handle;
    await handler({ body, user: { name: 'Owner', email: 'owner@example.com' } }, {
        status(code) { result.status = code; return this; }, json(data) { result.data = data; },
    });
    return result;
}

test('lists defaults, saved categories and legacy inventory names without case duplicates', async () => {
    saved.push({ name: 'Cleaning Supplies' }, { name: 'COFFEE' });
    const result = await request('get');
    assert.equal(result.status, 200);
    assert.ok(result.data.data.includes('Cleaning Supplies'));
    assert.ok(result.data.data.includes('Legacy Category'));
    assert.equal(result.data.data.filter(name => name.toLowerCase() === 'coffee').length, 1);
});

test('saves an independent category, normalizes whitespace and exposes it on subsequent loads', async () => {
    const result = await request('post', { name: '  Cleaning   Supplies  ', actorEmail: 'forged@example.com' });
    assert.equal(result.status, 201);
    assert.deepEqual(result.data.category, { name: 'Cleaning Supplies' });
    assert.equal(saved[0].nameKey, 'cleaning supplies');
    assert.ok((await request('get')).data.data.includes('Cleaning Supplies'));
    assert.equal(SystemAudit.create.mock.calls[0].arguments[0].actorEmail, 'owner@example.com');
    assert.equal(new InventoryCategory(saved[0]).validateSync(), undefined);
});

test('rejects empty, non-string and overlong names without saving', async () => {
    for (const name of ['', '   ', null, {}, ['New'], 2, 'a'.repeat(81)]) {
        assert.equal((await request('post', { name })).status, 400);
    }
    assert.equal(saved.length, 0);
});

test('rejects preset, legacy and saved duplicates case-insensitively, including a concurrent insert', async () => {
    saved.push({ name: 'Cleaning Supplies' });
    for (const name of [' coffee ', 'LEGACY CATEGORY', 'cleaning   supplies']) {
        assert.equal((await request('post', { name })).status, 409);
    }
    mock.method(InventoryCategory, 'create', async () => { throw { code: 11000 }; });
    assert.equal((await request('post', { name: 'Concurrent' })).status, 409);
});

test('reports database errors and does not claim a category was saved', async () => {
    mock.method(InventoryCategory, 'create', async () => { throw new Error('Database unavailable'); });
    assert.equal((await request('post', { name: 'Cleaning Supplies' })).status, 500);
    assert.equal(saved.length, 0);
    assert.equal(SystemAudit.create.mock.callCount(), 0);
});

test('category writes require inventory or purchase-order access and do not grant stock editing', () => {
    for (const [permissions, path, expected] of [
        [['inventory'], '/inventory/categories', true],
        [['purchase_orders'], '/inventory/categories', true],
        [['items'], '/inventory/categories', false],
        [['purchase_orders'], '/inventory/item1', false],
    ]) {
        let allowed = false;
        authorizeApi({ method: 'POST', path, user: { role: 'custom', email: 'custom@example.com', permissions }, body: {} },
            { status(code) { assert.equal(code, 403); return this; }, json() {} }, () => { allowed = true; });
        assert.equal(allowed, expected);
    }
});
