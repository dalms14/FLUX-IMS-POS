const { test, before, after, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const User = require('../models/User');
const SystemAudit = require('../models/SystemAudit');
const router = require('../Routes/authRoutes');
const { authorizeApi } = require('../middleware/apiSecurity');
const { defaultShiftSchedule, validateShiftSchedule } = require('../utils/shiftSchedule');

const id = '507f1f77bcf86cd799439011';
const schedule = { ...defaultShiftSchedule(), workdays: ['monday', 'friday'], startTime: '22:00', endTime: '06:00', restrictLogin: true };
const accounts = {
    owner: { role: 'owner', name: 'Owner', email: 'owner@example.com' },
    admin: { role: 'admin', name: 'Admin', email: 'admin@example.com', permissions: ['staff', 'users'] },
    restricted: { role: 'admin', email: 'restricted@example.com', permissions: ['staff'] },
    custom: { role: 'custom', email: 'custom@example.com', permissions: ['staff', 'users'] },
    staff: { role: 'staff', email: 'staff@example.com', permissions: ['staff', 'users'] },
};
let server, base;
before(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', (req, res, next) => { req.user = accounts[req.headers['x-test-user'] || 'owner']; next(); }, authorizeApi);
    app.use('/api/auth', router);
    server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    base = `http://127.0.0.1:${server.address().port}/api/auth/users`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); });
afterEach(() => mock.restoreAll());
const request = async ({ user = 'owner', body = { shiftSchedule: schedule }, targetId = id } = {}) => {
    const response = await fetch(`${base}/${targetId}/shift`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Test-User': user }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
};

test('new and legacy users default to unrestricted schedules; the model accepts overnight shifts', () => {
    const user = new User({ userId: 'TEST001' });
    assert.deepEqual(user.shiftSchedule.toObject(), defaultShiftSchedule());
    assert.equal(user.validateSync(), undefined);
    user.shiftSchedule = schedule;
    assert.equal(user.validateSync(), undefined);
    user.shiftSchedule.endTime = '22:00';
    assert.ok(user.validateSync().errors.shiftSchedule);
});

test('schedule validation supports daytime, overnight, zero allowance and clearing settings', () => {
    for (const values of [schedule, { ...schedule, startTime: '08:00', endTime: '17:00', earlyLoginMinutes: 0 }, defaultShiftSchedule()]) {
        assert.deepEqual(validateShiftSchedule(values).schedule, values);
    }
    assert.deepEqual(validateShiftSchedule({ ...schedule, workdays: ['friday', 'monday', 'friday'] }).schedule.workdays, ['monday', 'friday']);
});

test('owners and authorized admins save schedules and audit the authenticated actor', async t => {
    const user = new User({ _id: id, userId: 'ELI020', name: 'Operations', email: 'operations@example.com', role: 'custom' });
    t.mock.method(User, 'findById', async () => user);
    const save = t.mock.method(user, 'save', async () => user);
    const audit = t.mock.method(SystemAudit, 'create', async value => value);
    for (const actor of ['owner', 'admin']) {
        const result = await request({ user: actor, body: { shiftSchedule: schedule, currentUserEmail: 'forged@example.com' } });
        assert.equal(result.status, 200);
        assert.deepEqual(result.data.user.shiftSchedule, schedule);
        assert.equal(result.data.user.password, undefined);
        assert.equal(audit.mock.calls.at(-1).arguments[0].actorEmail, accounts[actor].email);
        assert.equal(audit.mock.calls.at(-1).arguments[0].action, 'Updated Shift');
        assert.deepEqual(user.shiftSchedule.toObject(), schedule);
    }
    assert.equal(save.mock.callCount(), 2);
    assert.deepEqual(audit.mock.calls[0].arguments[0].changes.previousShiftSchedule, defaultShiftSchedule());
});

test('staff, custom roles and admins without account management access cannot edit shifts', async t => {
    const find = t.mock.method(User, 'findById', async () => { throw new Error('Must not read target'); });
    for (const user of ['staff', 'custom', 'restricted']) {
        assert.equal((await request({ user, body: { shiftSchedule: schedule, currentUserEmail: accounts.owner.email } })).status, 403);
    }
    assert.equal(find.mock.callCount(), 0);
});

test('incomplete schedules, invalid times, allowance values and time zones are rejected before saving', async t => {
    const find = t.mock.method(User, 'findById', async () => { throw new Error('Must not read target'); });
    for (const change of [
        { workdays: [] }, { workdays: ['funday'] }, { workdays: 'monday' }, { startTime: '' }, { endTime: '' },
        { startTime: '24:00' }, { endTime: '12:60' }, { startTime: '8:00' }, { startTime: '22:00', endTime: '22:00' },
        { earlyLoginMinutes: -1 }, { earlyLoginMinutes: 121 }, { earlyLoginMinutes: 1.5 }, { earlyLoginMinutes: '15' },
        { restrictLogin: 'true' }, { timeZone: 'UTC' },
    ]) assert.equal((await request({ body: { shiftSchedule: { ...schedule, ...change } } })).status, 400);
    for (const shiftSchedule of [undefined, null, [], 'Monday']) assert.equal((await request({ body: { shiftSchedule } })).status, 400);
    assert.equal((await request({ targetId: 'bad-id' })).status, 400);
    assert.equal(find.mock.callCount(), 0);
});

test('missing, archived and owner accounts cannot be assigned a shift', async t => {
    let target;
    t.mock.method(User, 'findById', async () => target);
    for (const [account, status] of [[null, 404], [{ archived: true }, 404], [{ role: 'owner' }, 400], [{ role: 'admin', userId: 'ELI001' }, 400]]) {
        target = account;
        assert.equal((await request()).status, status);
    }
});

test('a saved shift can be cleared without altering role or page access', async t => {
    const user = new User({ _id: id, userId: 'ELI020', name: 'Staff', role: 'staff', permissions: ['items'], shiftSchedule: schedule });
    t.mock.method(User, 'findById', async () => user);
    t.mock.method(user, 'save', async () => user);
    t.mock.method(SystemAudit, 'create', async () => ({}));
    const result = await request({ body: { shiftSchedule: defaultShiftSchedule() } });
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.user.shiftSchedule, defaultShiftSchedule());
    assert.equal(result.data.user.role, 'staff');
    assert.deepEqual(result.data.user.permissions, ['items']);
});

test('user listing includes saved schedules and unrestricted defaults for older records', async t => {
    let projection;
    t.mock.method(User, 'find', () => ({ select(value) { projection = value; return this; }, sort() { return this; }, lean: async () => [
        { _id: id, name: 'Legacy', role: 'staff' }, { _id: 'other', name: 'Scheduled', role: 'staff', shiftSchedule: schedule },
    ] }));
    const response = await fetch(base, { headers: { 'X-Test-User': 'owner' } });
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.ok(projection.split(' ').includes('shiftSchedule'));
    assert.deepEqual(result.data[0].shiftSchedule, defaultShiftSchedule());
    assert.deepEqual(result.data[1].shiftSchedule, schedule);
});
