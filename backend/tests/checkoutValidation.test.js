const { test } = require('node:test');
const assert = require('node:assert/strict');
const validateGcashReference = require('../middleware/validateGcashReference');

const validate = body => {
    const result = {};
    validateGcashReference({ body }, { status(code) { result.status = code; return this; }, json(value) { result.data = value; } }, () => { result.proceeded = true; });
    return result;
};

test('GCash rejects letters, punctuation, numeric values and invalid lengths before checkout', () => {
    for (const gcashReference of ['abcdefghijklm', '123456789a', '123-4567890', '123456789', '12345678901234', 1234567890, null]) {
        assert.equal(validate({ paymentMethod: 'GCash', gcashReference }).status, 400);
    }
});

test('GCash preserves leading zeroes and accepts the existing 10 to 13 digit range; cash is unaffected', () => {
    for (const gcashReference of ['0012345678', '0012345678901']) assert.equal(validate({ paymentMethod: 'GCash', gcashReference }).proceeded, true);
    assert.equal(validate({ paymentMethod: 'Cash' }).proceeded, true);
});
