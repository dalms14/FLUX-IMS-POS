const { test, before, after, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const EliteMember = require('../models/EliteMember');
const SystemAudit = require('../models/SystemAudit');
const { authorizeApi } = require('../middleware/apiSecurity');
const router = require('../Routes/eliteMemberRoutes');
const users = { owner: { role: 'owner', name: 'Owner', email: 'owner@example.com' }, admin: { role: 'admin', name: 'Admin', email: 'admin@example.com' },
    staff: { role: 'staff', name: 'Staff', email: 'staff@example.com' }, restricted: { role: 'admin', name: 'Restricted', email: 'restricted@example.com', permissions: ['items'] },
    custom: { role: 'custom', name: 'Membership Clerk', email: 'clerk@example.com', permissions: ['elite_members'] },
    productsOnly: { role: 'admin', name: 'Product Admin', email: 'products@example.com', permissions: ['products'] },
    legacyCustom: { role: 'custom', name: 'Legacy Custom', email: 'legacy@example.com' } };
let server, base;
before(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', (req, res, next) => { req.user = users[req.headers['x-test-user'] || 'staff']; next(); }, authorizeApi);
    app.use('/api/elite-members', router);
    server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    base = `http://127.0.0.1:${server.address().port}/api/elite-members`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); });
afterEach(() => mock.restoreAll());
const request = async (path = '', { user = 'staff', method = 'GET', body } = {}) => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Test-User': user }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
};
const member = { _id: '507f1f77bcf86cd799439011', name: 'Registered member', idNumber: '000123', status: 'active', notes: '' };

test('accounts without Elite Membership access cannot register, edit, archive or restore cards', async () => {
    for (const user of ['staff', 'restricted', 'productsOnly', 'legacyCustom']) {
        assert.equal((await request('', { user, method: 'POST', body: member })).status, 403);
        assert.equal((await request('/' + member._id, { user, method: 'PATCH', body: member })).status, 403);
        assert.equal((await request('/' + member._id + '/archive', { user, method: 'POST' })).status, 403);
        assert.equal((await request('/' + member._id + '/restore', { user, method: 'POST' })).status, 403);
    }
});

test('a custom role with only Elite Membership access can register a member without Products access', async t => {
    t.mock.method(EliteMember, 'create', async values => ({ ...values, _id: member._id }));
    t.mock.method(SystemAudit, 'create', async () => ({}));
    assert.equal((await request('', { user: 'custom', method: 'POST', body: member })).status, 201);
    t.mock.method(EliteMember, 'findOneAndUpdate', async (_filter, update) => ({ ...member, ...update.$set }));
    assert.equal((await request('/' + member._id, { user: 'custom', method: 'PATCH', body: member })).status, 200);
    assert.equal((await request('/' + member._id + '/archive', { user: 'custom', method: 'POST' })).status, 200);
    assert.equal((await request('/' + member._id + '/restore', { user: 'custom', method: 'POST' })).status, 200);
});
test('registration records validated card details and the authenticated audit actor', async t => {
    let saved, audit;
    t.mock.method(EliteMember, 'create', async value => { saved = value; return { ...value, _id: member._id }; });
    t.mock.method(SystemAudit, 'create', async value => { audit = value; return value; });
    const result = await request('', { user: 'admin', method: 'POST', body: { ...member, name: '  Registered member  ', actor: 'Forged', actorEmail: 'forged@example.com' } });
    assert.equal(result.status, 201);
    assert.equal(saved.name, member.name);
    assert.equal(saved.idNumber, '000123');
    assert.equal(audit.actorEmail, users.admin.email);
    assert.equal(saved._id, undefined);
});
test('duplicate IDs return a useful conflict and the schema enforces a unique card index', async t => {
    t.mock.method(EliteMember, 'create', async () => { throw Object.assign(new Error('Duplicate'), { code: 11000 }); });
    const result = await request('', { user: 'owner', method: 'POST', body: member });
    assert.equal(result.status, 409);
    assert.match(result.data.message, /already registered/);
    assert.ok(EliteMember.schema.indexes().some(([keys, options]) => keys.idNumber === 1 && options.unique));
});
test('staff lookup always selects active records and does not expose management notes', async t => {
    let filter, projection;
    t.mock.method(EliteMember, 'find', value => { filter = value; return { select(value) { projection = value; return this; }, sort() { return this; }, limit() { return this; }, lean: async () => [] }; });
    assert.equal((await request('?includeInactive=true&archived=true&search=%5B')).status, 200);
    assert.equal(filter.status, 'active');
    assert.deepEqual(filter.archived, { $ne: true });
    assert.equal(filter.$or[0].name.$regex, '\\[');
    assert.equal(projection.includes('notes'), false);
    await request('?includeInactive=true', { user: 'owner' });
    assert.equal(filter.status, undefined);
    assert.equal(projection.includes('notes'), true);
    assert.deepEqual(filter.archived, { $ne: true });
    await request('?includeInactive=true&archived=true', { user: 'owner' });
    assert.equal(filter.archived, true);
});
test('verification checks active status and returns canonical details without private notes', async t => {
    t.mock.method(EliteMember, 'findOne', filter => { assert.deepEqual(filter, { idNumber: '000123', status: 'active', archived: { $ne: true } }); return { lean: async () => member }; });
    const result = await request('/verify', { method: 'POST', body: { idNumber: '000123', name: 'Forged' } });
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.member, { name: member.name, idNumber: member.idNumber });
});
test('deactivation preserves the record and creates an audit entry', async t => {
    let update;
    t.mock.method(EliteMember, 'findOneAndUpdate', async (filter, values, options) => {
        assert.deepEqual(filter, { _id: member._id, archived: { $ne: true } }); assert.equal(options.runValidators, true); update = values;
        return { ...member, ...values.$set };
    });
    t.mock.method(SystemAudit, 'create', async () => ({}));
    const result = await request('/' + member._id, { user: 'owner', method: 'PATCH', body: { ...member, status: 'inactive' } });
    assert.equal(result.status, 200);
    assert.equal(update.$set.status, 'inactive');
});
test('registration and editing reject invalid names, card IDs, statuses and record IDs', async () => {
    for (const change of [{ name: ' ' }, { name: 'x'.repeat(121) }, { idNumber: 123 }, { idNumber: '1e2' }, { idNumber: '1234567890123' }, { status: 'unknown' }, { notes: 'x'.repeat(501) }]) {
        assert.equal((await request('', { user: 'owner', method: 'POST', body: { ...member, ...change } })).status, 400);
    }
    assert.equal((await request('/bad-id', { user: 'owner', method: 'PATCH', body: member })).status, 400);
});

test('numeric and non-name characters are rejected on both create and edit before database writes', async t => {
    const create = t.mock.method(EliteMember, 'create', async () => { throw new Error('Must not create'); });
    const update = t.mock.method(EliteMember, 'findOneAndUpdate', async () => { throw new Error('Must not update'); });
    for (const name of ['1923180943812098122', 'Athan123', 'Member ２', 'Member\nName', '...---', 'Name😀', 'Name@Shop']) {
        for (const [path, method] of [['', 'POST'], ['/' + member._id, 'PATCH']]) {
            const result = await request(path, { user: 'owner', method, body: { ...member, name } });
            assert.equal(result.status, 400);
            assert.match(result.data.message, /Member name/);
        }
    }
    assert.equal(create.mock.callCount(), 0);
    assert.equal(update.mock.callCount(), 0);
});

test('model validation accepts international names and rejects numeric names', () => {
    for (const name of ['Athan Scott Saroca', 'María O’Connor-Santos Jr.', "José D'Angelo", 'Jose\u0301', '李明']) {
        assert.equal(new EliteMember({ ...member, name }).validateSync(), undefined);
    }
    for (const name of ['123456', 'Athan123', '---', 'Name@Shop']) {
        assert.ok(new EliteMember({ ...member, name }).validateSync()?.errors.name);
    }
});

test('archive and restore preserve the card, block checkout while archived and audit both actions', async t => {
    let saved = { ...member, archived: false };
    const audits = [];
    t.mock.method(EliteMember, 'findOneAndUpdate', async (filter, update, options) => {
        assert.equal(filter._id, member._id);
        assert.equal(options.runValidators, true);
        assert.deepEqual(Object.keys(update.$set).sort(), ['archived', 'archivedAt', 'archivedBy']);
        const expectedArchived = filter.archived === true;
        if (Boolean(saved.archived) !== expectedArchived) return null;
        saved = { ...saved, ...update.$set };
        return saved;
    });
    t.mock.method(EliteMember, 'findOne', filter => {
        assert.deepEqual(filter.archived, { $ne: true });
        return { lean: async () => saved.archived || saved.status !== 'active' ? null : saved };
    });
    t.mock.method(SystemAudit, 'create', async value => { audits.push(value); return value; });
    const archived = await request('/' + member._id + '/archive', { user: 'owner', method: 'POST' });
    assert.equal(archived.status, 200);
    assert.equal(saved.archived, true);
    assert.equal(saved.idNumber, member.idNumber);
    assert.equal(saved.archivedBy, users.owner.email);
    assert.equal(saved.status, 'active');
    assert.equal((await request('/verify', { method: 'POST', body: { idNumber: member.idNumber } })).status, 409);
    assert.equal((await request('/' + member._id + '/archive', { user: 'owner', method: 'POST' })).status, 404);
    const restored = await request('/' + member._id + '/restore', { user: 'admin', method: 'POST' });
    assert.equal(restored.status, 200);
    assert.equal(saved.archived, false);
    assert.equal(saved.archivedAt, null);
    assert.equal(saved.status, 'active');
    assert.equal((await request('/verify', { method: 'POST', body: { idNumber: member.idNumber } })).status, 200);
    assert.deepEqual(audits.map(row => row.action), ['Archived', 'Restored']);
});

test('archiving legacy invalid names is allowed, and restoration does not reactivate inactive cards', async t => {
    let saved = { ...member, name: '123456', status: 'inactive' };
    t.mock.method(EliteMember, 'findOneAndUpdate', async (_filter, update) => { saved = { ...saved, ...update.$set }; return saved; });
    t.mock.method(SystemAudit, 'create', async () => ({}));
    assert.equal((await request('/' + member._id + '/archive', { user: 'owner', method: 'POST' })).status, 200);
    assert.equal((await request('/' + member._id + '/restore', { user: 'owner', method: 'POST' })).status, 200);
    assert.equal(saved.status, 'inactive');
    assert.equal(saved.name, '123456');
});

test('archive actions reject invalid IDs and editing cannot bypass an archived record', async t => {
    assert.equal((await request('/bad-id/archive', { user: 'owner', method: 'POST' })).status, 400);
    assert.equal((await request('/bad-id/restore', { user: 'owner', method: 'POST' })).status, 400);
    t.mock.method(EliteMember, 'findOneAndUpdate', async (filter, update) => {
        assert.deepEqual(filter.archived, { $ne: true });
        assert.equal(update.$set.archived, undefined);
        return null;
    });
    assert.equal((await request('/' + member._id, { user: 'owner', method: 'PATCH', body: { ...member, archived: false } })).status, 404);
});
