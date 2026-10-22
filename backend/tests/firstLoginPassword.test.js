const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const LoginActivity = require('../models/LoginActivity');
const SystemAudit = require('../models/SystemAudit');
const router = require('../Routes/authRoutes');

const originals = { findOne: User.findOne, update: User.findOneAndUpdate, activity: LoginActivity.create, audit: SystemAudit.create };
const invoke = async (path, body) => {
  let status = 200;
  let data;
  const res = { status(code) { status = code; return this; }, json(value) { data = value; return this; } };
  await router.stack.find(layer => layer.route?.path === path).route.stack[0].handle({ body, headers: {}, ip: '127.0.0.1' }, res);
  return { status, data };
};
let account;
beforeEach(async () => {
  account = { _id: 'test-user', email: 'new-staff@example.com', role: 'staff', name: 'New Staff', userId: 'TEST001', mustChangePassword: true, password: await bcrypt.hash('password123', 4), async save() {} };
  User.findOne = async filter => {
    if (filter.email) return account;
    return account.mustChangePassword && !account.archived && account.firstLoginTokenHash === filter.firstLoginTokenHash && account.firstLoginTokenExpiresAt > filter.firstLoginTokenExpiresAt.$gt ? account : null;
  };
  User.findOneAndUpdate = async (filter, update) => {
    if (!(await User.findOne(filter))) return null;
    Object.assign(account, update.$set);
    return account;
  };
  LoginActivity.create = async () => ({});
  SystemAudit.create = async () => ({});
});
afterEach(() => {
  User.findOne = originals.findOne;
  User.findOneAndUpdate = originals.update;
  LoginActivity.create = originals.activity;
  SystemAudit.create = originals.audit;
});
const login = () => invoke('/login', { email: account.email, password: 'password123' });

test('temporary-password login issues only a restricted challenge; new password completes login and cannot be replayed', async () => {
  const result = await login();
  assert.equal(result.data.mustChangePassword, true);
  assert.equal(result.data.role, undefined);
  const token = result.data.passwordChangeToken;
  assert.equal(account.firstLoginTokenHash, crypto.createHash('sha256').update(token).digest('hex'));
  const body = { token, newPassword: 'NewSecret123', confirmPassword: 'NewSecret123' };
  const completed = await invoke('/first-login-password', body);
  assert.equal(completed.status, 200);
  assert.equal(completed.data.user.email, account.email);
  assert.equal(completed.data.user.password, undefined);
  assert.equal(account.mustChangePassword, false);
  assert.equal(await bcrypt.compare('NewSecret123', account.password), true);
  assert.equal(await bcrypt.compare('password123', account.password), false);
  assert.equal((await invoke('/first-login-password', body)).status, 401);
});

test('rejects mismatched and weak passwords without consuming the challenge', async () => {
  const { data } = await login();
  const token = data.passwordChangeToken;
  assert.equal((await invoke('/first-login-password', { token, newPassword: 'NewSecret123', confirmPassword: 'different' })).status, 400);
  assert.equal((await invoke('/first-login-password', { token, newPassword: 'weak', confirmPassword: 'weak' })).status, 400);
  assert.equal(account.mustChangePassword, true);
});

test('rejects reused temporary password even if it meets the new-password rules', async () => {
  account.password = await bcrypt.hash('Temporary123', 4);
  const { data } = await invoke('/login', { email: account.email, password: 'Temporary123' });
  const result = await invoke('/first-login-password', { token: data.passwordChangeToken, newPassword: 'Temporary123', confirmPassword: 'Temporary123' });
  assert.equal(result.status, 400);
  assert.equal(account.mustChangePassword, true);
});

test('expired, invalid, and archived-account challenges cannot change a password', async () => {
  const { data } = await login();
  const body = { token: data.passwordChangeToken, newPassword: 'NewSecret123', confirmPassword: 'NewSecret123' };
  account.firstLoginTokenExpiresAt = new Date(0);
  assert.equal((await invoke('/first-login-password', body)).status, 401);
  assert.equal((await invoke('/first-login-password', { ...body, token: 'bad' })).status, 401);
  account.firstLoginTokenExpiresAt = new Date(Date.now() + 60000);
  account.archived = true;
  assert.equal((await invoke('/first-login-password', body)).status, 401);
});

test('existing accounts continue directly to normal login', async () => {
  account.mustChangePassword = false;
  const { data } = await login();
  assert.equal(data.email, account.email);
  assert.equal(data.mustChangePassword, undefined);
  assert.equal(data.passwordChangeToken, undefined);
});
