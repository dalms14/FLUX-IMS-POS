const { test } = require('node:test');
const assert = require('node:assert/strict');
const EliteMember = require('../models/EliteMember');
const validateEliteMember = require('../middleware/validateEliteMember');

async function validate(body) {
    const req = { body };
    const result = { status: 200, proceeded: false };
    const res = { status(code) { result.status = code; return this; }, json(data) { result.data = data; return this; } };
    await validateEliteMember(req, res, () => { result.proceeded = true; });
    return { ...result, body: req.body };
}

test('checkout validates a registered active card and uses its saved name, preserving zeroes', async t => {
    const queries = [];
    t.mock.method(EliteMember, 'findOne', filter => { queries.push(filter); return { lean: async () => ({ name: 'Registered name', idNumber: filter.idNumber, status: 'active' }) }; });
    for (const idNumber of ['1', '000123', '001234567890']) {
        const result = await validate({ customerType: 'elite', eliteMember: { name: 'Forged name', idNumber } });
        assert.equal(result.proceeded, true);
        assert.deepEqual(result.body.eliteMember, { name: 'Registered name', idNumber });
    }
    assert.ok(queries.every(query => query.status === 'active'));
    assert.ok(queries.every(query => query.archived?.$ne === true));
});

test('invalid card IDs are rejected before any registry lookup', async t => {
    const find = t.mock.method(EliteMember, 'findOne', () => { throw new Error('Must not query'); });
    for (const idNumber of ['', '1234567890123', '123a', '123-456', '123 456', ' 123', 123, null, undefined, { $ne: null }]) {
        const result = await validate({ customerType: 'elite', eliteMember: { idNumber } });
        assert.equal(result.status, 400);
        assert.equal(result.proceeded, false);
    }
    assert.equal(find.mock.callCount(), 0);
});

test('missing member, unregistered card and deactivated card cannot complete an Elite sale', async t => {
    t.mock.method(EliteMember, 'findOne', () => ({ lean: async () => null }));
    for (const eliteMember of [undefined, null, {}, { idNumber: '000123' }]) {
        const result = await validate({ customerType: 'elite', eliteMember });
        assert.equal(result.proceeded, false);
        assert.ok([400, 409].includes(result.status));
        assert.equal(result.data.code, 'INVALID_ELITE_MEMBER');
    }
});

test('registry failures block the sale rather than trusting submitted or browser-saved details', async t => {
    t.mock.method(EliteMember, 'findOne', () => ({ lean: async () => { throw new Error('Offline test'); } }));
    const result = await validate({ customerType: 'elite', eliteMember: { name: 'Unverified', idNumber: '001' } });
    assert.equal(result.status, 503);
    assert.equal(result.proceeded, false);
});

test('a previously selected card is rejected at checkout after it has been archived', async t => {
    t.mock.method(EliteMember, 'findOne', filter => {
        assert.deepEqual(filter, { idNumber: '001', status: 'active', archived: { $ne: true } });
        return { lean: async () => null };
    });
    const result = await validate({ customerType: 'elite', eliteMember: { name: 'Previously selected', idNumber: '001' } });
    assert.equal(result.status, 409);
    assert.equal(result.proceeded, false);
    assert.match(result.data.message, /archived/);
});

test('non-Elite sales do not require a lookup and discard unrelated membership details', async t => {
    const find = t.mock.method(EliteMember, 'findOne', () => { throw new Error('Must not query'); });
    for (const customerType of [undefined, 'customer', 'pwd_senior', 'pagibig', 'custom_discount']) {
        const result = await validate({ customerType, eliteMember: { name: 'Stale member', idNumber: '001' } });
        assert.equal(result.proceeded, true);
        assert.equal(result.body.eliteMember, null);
    }
    assert.equal(find.mock.callCount(), 0);
});
