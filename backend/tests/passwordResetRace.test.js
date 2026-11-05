const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const AuthSession = require('../models/AuthSession');
const SystemAudit = require('../models/SystemAudit');
const router = require('../Routes/authRoutes');
const handler = router.stack.find(layer => layer.route?.path === '/password-reset/confirm').route.stack[0].handle;
const query = value => ({ then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }, select() { return this; } });

async function setup(t) {
    const account = { _id: 'account1', email: 'staff@example.com', name: 'Staff', password: await bcrypt.hash('OldSecret123', 4),
        passwordResetOtpHash: crypto.createHash('sha256').update('123456').digest('hex'), passwordResetOtpExpiresAt: new Date(Date.now() + 60000), passwordResetOtpUsedAt: null, passwordResetOtpAttempts: 0 };
    t.mock.method(User, 'findOne', () => query({ ...account }));
    t.mock.method(User, 'findOneAndUpdate', (filter, update) => {
        const max = filter.passwordResetOtpAttempts;
        if (filter.passwordResetOtpHash !== account.passwordResetOtpHash || filter.password !== account.password || account.passwordResetOtpUsedAt ||
            account.passwordResetOtpExpiresAt <= filter.passwordResetOtpExpiresAt.$gt ||
            max.$lt !== undefined && account.passwordResetOtpAttempts >= max.$lt || max.$lte !== undefined && account.passwordResetOtpAttempts > max.$lte) return query(null);
        if (update.$inc) account.passwordResetOtpAttempts += update.$inc.passwordResetOtpAttempts;
        if (update.$set) Object.assign(account, update.$set);
        return query({ ...account });
    });
    t.mock.method(AuthSession, 'deleteMany', async () => ({}));
    t.mock.method(SystemAudit, 'create', async () => ({}));
    return account;
}
async function confirm(otp) {
    const result = { status: 200 };
    await handler({ body: { email: 'staff@example.com', otp, newPassword: 'NewSecret123' } }, { status(code) { result.status = code; return this; }, json(data) { result.data = data; } });
    return result;
}
test('concurrent incorrect reset codes reserve at most five attempts on a challenge', async t => {
    const account = await setup(t);
    const results = await Promise.all(Array.from({ length: 20 }, () => confirm('999999')));
    assert.equal(account.passwordResetOtpAttempts, 5);
    assert.equal(results.filter(result => result.status === 400).length, 5);
    assert.equal(results.filter(result => result.status === 429).length, 15);
    assert.equal(await bcrypt.compare('OldSecret123', account.password), true);
});
test('concurrent correct reset submissions consume a challenge only once and revoke old sessions', async t => {
    const account = await setup(t);
    const results = await Promise.all(Array.from({ length: 4 }, () => confirm('123456')));
    assert.equal(results.filter(result => result.status === 200).length, 1);
    assert.equal(AuthSession.deleteMany.mock.callCount(), 1);
    assert.equal(await bcrypt.compare('NewSecret123', account.password), true);
    assert.equal(account.passwordResetOtpHash, null);
});
