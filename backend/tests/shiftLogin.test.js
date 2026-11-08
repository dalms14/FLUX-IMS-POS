const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AuthSession = require('../models/AuthSession');
const LoginActivity = require('../models/LoginActivity');
const SystemAudit = require('../models/SystemAudit');
const router = require('../Routes/authRoutes');
const { defaultShiftSchedule, getShiftLoginAccess } = require('../utils/shiftSchedule');

const shift = { ...defaultShiftSchedule(), workdays: ['monday'], startTime: '08:00', endTime: '17:00', restrictLogin: true };
const access = (date, schedule = shift, role = 'staff') => getShiftLoginAccess({ role, shiftSchedule: schedule }, new Date(date));
const invoke = async (path, body) => {
    const result = { status: 200 };
    const handler = router.stack.find(layer => layer.route?.path === path && layer.route.methods.post).route.stack[0].handle;
    await handler({ body, headers: { 'user-agent': 'Shift test browser' }, ip: '127.0.0.1' }, {
        status(code) { result.status = code; return this; }, json(value) { result.data = value; return this; },
    });
    return result;
};
let sequence = 0;
async function setup(t, changes = {}, now = '2026-11-09T07:00:00+08:00') {
    const activities = [], audits = [], sessions = [];
    const user = { _id: '507f1f77bcf86cd799439011', name: 'Shift Staff', email: `shift${++sequence}@example.com`, role: 'staff', userId: 'TEST020',
        password: await bcrypt.hash('ValidSecret123', 4), shiftSchedule: { ...shift }, ...changes };
    const save = t.mock.fn(async () => user);
    user.save = save;
    t.mock.timers.enable({ apis: ['Date'], now: new Date(now).getTime() });
    t.mock.method(User, 'findOne', async filter => {
        if (filter.email) return filter.email === user.email ? user : null;
        return user.mustChangePassword && !user.archived && user.firstLoginTokenHash === filter.firstLoginTokenHash
            && user.firstLoginTokenExpiresAt > filter.firstLoginTokenExpiresAt.$gt ? user : null;
    });
    const update = t.mock.method(User, 'findOneAndUpdate', async (_filter, values) => { Object.assign(user, values.$set); return user; });
    t.mock.method(AuthSession, 'create', async values => { sessions.push(values); return values; });
    t.mock.method(LoginActivity, 'create', async values => {
        const row = new LoginActivity(values);
        await row.validate();
        activities.push(row.toObject()); return row;
    });
    t.mock.method(SystemAudit, 'create', async values => { audits.push(values); return values; });
    const login = (password = 'ValidSecret123', extra = {}) => invoke('/login', { email: user.email, password, ...extra });
    return { user, activities, audits, sessions, save, update, login };
}

test('daytime shifts use Philippine dates, inclusive opening and exclusive closing', () => {
    for (const [time, allowed] of [
        ['2026-11-09T07:44:59+08:00', false], ['2026-11-09T07:45:00+08:00', true],
        ['2026-11-09T00:00:00Z', true], ['2026-11-09T16:59:59+08:00', true],
        ['2026-11-09T17:00:00+08:00', false], ['2026-11-10T08:00:00+08:00', false],
    ]) assert.equal(access(time).allowed, allowed, time);
    assert.equal(access('2026-11-09T07:44:59+08:00').nextAllowedAt.toISOString(), '2026-11-08T23:45:00.000Z');
    assert.equal(access('2026-11-09T17:00:00+08:00').nextAllowedAt.toISOString(), '2026-11-15T23:45:00.000Z');
    const noGrace = { ...shift, earlyLoginMinutes: 0 };
    assert.equal(access('2026-11-09T07:59:59+08:00', noGrace).allowed, false);
    assert.equal(access('2026-11-09T08:00:00+08:00', noGrace).allowed, true);
});

test('overnight shifts continue into the next unselected day and stop at the end time', () => {
    const overnight = { ...shift, startTime: '22:00', endTime: '06:00' };
    for (const [time, allowed] of [
        ['2026-11-09T05:00:00+08:00', false], ['2026-11-09T21:44:59+08:00', false],
        ['2026-11-09T21:45:00+08:00', true], ['2026-11-10T05:59:59+08:00', true],
        ['2026-11-10T06:00:00+08:00', false], ['2026-11-10T22:00:00+08:00', false],
    ]) assert.equal(access(time, overnight).allowed, allowed, time);
    assert.equal(access('2026-11-09T05:00:00+08:00', { ...overnight, workdays: ['sunday'] }).allowed, true);
});

test('early access crosses midnight, week and year boundaries for the upcoming assigned day', () => {
    const midnight = { ...shift, startTime: '00:30', endTime: '08:00', earlyLoginMinutes: 120 };
    assert.equal(access('2026-11-08T22:29:59+08:00', midnight).allowed, false);
    assert.equal(access('2026-11-08T22:30:00+08:00', midnight).allowed, true);
    assert.equal(access('2026-11-09T00:29:00+08:00', midnight).allowed, true);
    assert.equal(access('2026-12-31T22:30:00+08:00', { ...midnight, workdays: ['friday'] }).allowed, true);
    assert.equal(access('2026-12-31T22:29:59+08:00', { ...midnight, workdays: ['friday'] }).nextAllowedAt.toISOString(), '2026-12-31T14:30:00.000Z');
});

test('disabled and legacy schedules allow login, owners/admins are exempt, and invalid restricted schedules block', () => {
    assert.equal(getShiftLoginAccess({ role: 'staff' }).allowed, true);
    assert.equal(access('2026-11-08T08:00:00+08:00', { ...shift, restrictLogin: false }).allowed, true);
    for (const role of ['owner', 'admin', ' Admin ']) assert.equal(access('2026-11-08T08:00:00+08:00', shift, role).allowed, true);
    assert.equal(access('2026-11-08T08:00:00+08:00', shift, 'custom').allowed, false);
    assert.equal(getShiftLoginAccess({ role: 'custom', email: 'admin@elicoffee.com', shiftSchedule: shift }).allowed, true);
    assert.equal(access('2026-11-09T08:00:00+08:00', { ...shift, workdays: [] }).reason, 'invalid_schedule');
    assert.equal(access('2026-11-09T08:00:00+08:00', { ...shift, timeZone: 'UTC' }).reason, 'invalid_schedule');
    const document = new User({ userId: 'TEST020', role: 'staff', shiftSchedule: shift });
    assert.equal(getShiftLoginAccess(document, new Date('2026-11-09T08:00:00+08:00')).allowed, true);
});

test('off-shift login is blocked before any session or online update and records its schedule snapshot', async t => {
    const state = await setup(t);
    const result = await state.login('ValidSecret123', { shiftSchedule: { restrictLogin: false }, role: 'admin' });
    assert.equal(result.status, 403);
    assert.equal(result.data.code, 'OUTSIDE_SHIFT');
    assert.match(result.data.message, /Next allowed sign-in/);
    assert.match(result.data.message, /Philippine time/);
    assert.equal(result.data.nextAllowedAt.toISOString(), '2026-11-08T23:45:00.000Z');
    assert.equal(result.data.sessionToken, undefined);
    assert.equal(state.sessions.length, 0);
    assert.equal(state.save.mock.callCount(), 0);
    assert.equal(state.user.isOnline, undefined);
    assert.equal(state.activities[0].action, 'login_blocked_off_shift');
    assert.equal(state.activities[0].blockedReason, 'off_shift');
    assert.deepEqual(state.activities[0].shiftSchedule, shift);
    assert.equal(state.activities[0].createdAt.toISOString(), '2026-11-08T23:00:00.000Z');
    assert.equal(state.audits[0].actorEmail, state.user.email);
    assert.deepEqual(state.audits[0].changes.shiftSchedule, shift);
});

test('wrong passwords do not create outside-shift records and verified off-shift attempts do not cause credential lockout', async t => {
    const state = await setup(t);
    assert.equal((await state.login('wrong')).status, 401);
    assert.equal(state.activities.length, 0);
    for (let attempt = 0; attempt < 4; attempt += 1) {
        const result = await state.login();
        assert.equal(result.status, 403);
        assert.equal(result.data.attemptsRemaining, 3);
    }
    assert.equal(state.activities.length, 4);
    assert.equal(state.sessions.length, 0);
});

test('valid early-access login issues a session and records a successful login', async t => {
    const state = await setup(t, {}, '2026-11-09T07:45:00+08:00');
    const result = await state.login();
    assert.equal(result.status, 200);
    assert.match(result.data.sessionToken, /^[a-f0-9]{64}$/);
    assert.equal(state.sessions.length, 1);
    assert.equal(state.activities[0].action, 'login');
    assert.equal(state.user.isOnline, true);
});

test('switching restrictions off permits an otherwise off-shift login', async t => {
    const state = await setup(t, { shiftSchedule: { ...shift, restrictLogin: false } });
    assert.equal((await state.login()).status, 200);
    assert.equal(state.activities[0].action, 'login');
    assert.equal(state.sessions.length, 1);
});

test('logging failures cannot allow an off-shift login', async t => {
    const state = await setup(t);
    t.mock.method(LoginActivity, 'create', async () => { throw new Error('Activity unavailable'); });
    t.mock.method(SystemAudit, 'create', async () => { throw new Error('Audit unavailable'); });
    t.mock.method(console, 'error', () => {});
    assert.equal((await state.login()).data.code, 'OUTSIDE_SHIFT');
    assert.equal(state.sessions.length, 0);
    assert.equal(state.save.mock.callCount(), 0);
});

test('admin and owner sessions remain available outside assigned shifts', async t => {
    for (const role of ['admin', 'owner']) await t.test(role, async child => {
        const state = await setup(child, { role });
        assert.equal((await state.login()).status, 200);
        assert.equal(state.activities[0].action, 'login');
        assert.equal(state.sessions.length, 1);
    });
});

test('an off-shift first login cannot obtain a password-change challenge', async t => {
    const state = await setup(t, { mustChangePassword: true });
    const result = await state.login();
    assert.equal(result.status, 403);
    assert.equal(result.data.passwordChangeToken, undefined);
    assert.equal(state.save.mock.callCount(), 0);
});

test('first-password completion rechecks the current schedule and keeps a blocked challenge unconsumed', async t => {
    const state = await setup(t, { mustChangePassword: true, shiftSchedule: { ...shift, endTime: '08:05', earlyLoginMinutes: 0 } }, '2026-11-09T08:00:00+08:00');
    const challenge = await state.login();
    assert.equal(challenge.data.mustChangePassword, true);
    t.mock.timers.setTime(new Date('2026-11-09T08:06:00+08:00').getTime());
    const result = await invoke('/first-login-password', { token: challenge.data.passwordChangeToken, newPassword: 'NewSecret123', confirmPassword: 'NewSecret123' });
    assert.equal(result.status, 403);
    assert.equal(result.data.code, 'OUTSIDE_SHIFT');
    assert.equal(state.update.mock.callCount(), 0);
    assert.equal(state.user.mustChangePassword, true);
    assert.ok(state.user.firstLoginTokenHash);
    assert.equal(state.sessions.length, 0);
    assert.equal(state.activities[0].action, 'login_blocked_off_shift');
});

test('invalid restricted schedules block login and archived accounts retain their own blocked reason', async t => {
    await t.test('invalid schedule', async child => {
        const state = await setup(child, { shiftSchedule: { ...shift, workdays: [] } });
        assert.equal((await state.login()).data.code, 'SHIFT_SCHEDULE_INVALID');
        assert.equal(state.activities[0].blockedReason, 'invalid_schedule');
        assert.equal(state.sessions.length, 0);
    });
    await t.test('archived account', async child => {
        const state = await setup(child, { archived: true });
        assert.equal((await state.login()).data.code, 'ACCOUNT_ARCHIVED');
        assert.equal(state.activities[0].action, 'login_blocked_archived');
        assert.equal(state.audits.length, 0);
    });
});
