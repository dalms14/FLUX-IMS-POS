const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../models/User');
const { seedConfiguration, seedAccount } = require('../services/seedAccount');

test('seed configuration has no default password, requires a strong secret and forces replacement', () => {
    assert.throws(() => seedConfiguration({}, true), /strong/);
    const config = seedConfiguration({ SEED_OWNER_PASSWORD: 'TemporarySecret123' }, true);
    assert.equal(config.mustChangePassword, true);
    assert.equal(config.pin, undefined);
    assert.throws(() => seedConfiguration({ SEED_OWNER_PASSWORD: 'TemporarySecret123', SEED_OWNER_PIN: '1234' }, true), /six digits/);
});
test('an existing owner is preserved when the owner seed is rerun', async t => {
    t.mock.method(mongoose, 'connect', async () => ({}));
    t.mock.method(mongoose, 'disconnect', async () => ({}));
    t.mock.method(User, 'exists', async () => true);
    const create = t.mock.method(User, 'create', async () => { throw new Error('Must not overwrite'); });
    await seedAccount({ SEED_OWNER_PASSWORD: 'TemporarySecret123' }, true);
    assert.equal(create.mock.callCount(), 0);
});
