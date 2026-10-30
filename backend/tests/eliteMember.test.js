const { test } = require('node:test');
const assert = require('node:assert/strict');
const validateEliteMember = require('../middleware/validateEliteMember');

const validate = body => {
    const req = { body };
    const result = { status: 200, proceeded: false };
    const res = {
        status(code) { result.status = code; return this; },
        json(data) { result.data = data; return this; },
    };
    validateEliteMember(req, res, () => { result.proceeded = true; });
    return { ...result, body: req.body };
};

test('accepts card IDs up to 12 digits, preserving leading zeroes and trimming names', () => {
    for (const idNumber of ['1', '000123', '001234567890']) {
        const result = validate({ customerType: 'elite', eliteMember: { name: '  Daniel  ', idNumber } });
        assert.equal(result.proceeded, true);
        assert.deepEqual(result.body.eliteMember, { name: 'Daniel', idNumber });
    }
});

test('rejects invalid IDs before checkout can proceed', () => {
    for (const idNumber of ['', '1234567890123', '12345678901a', '123-456', '123 456', ' 123', 123456789012, null, undefined]) {
        const result = validate({ customerType: 'elite', eliteMember: { name: 'Daniel', idNumber } });
        assert.equal(result.status, 400);
        assert.equal(result.proceeded, false);
        assert.equal(result.data.code, 'INVALID_ELITE_MEMBER');
        assert.match(result.data.message, /1 to 12 digits/);
    }
});

test('an Elite Member must supply a name and card details', () => {
    for (const eliteMember of [undefined, null, {}, { name: '  ', idNumber: '123456789012' }]) {
        const result = validate({ customerType: 'elite', eliteMember });
        assert.equal(result.status, 400);
        assert.equal(result.proceeded, false);
    }
});

test('ordinary customers and other discount types do not require an Elite Member card', () => {
    for (const customerType of [undefined, 'customer', 'pwd_senior', 'pagibig', 'custom_discount']) {
        assert.equal(validate({ customerType }).proceeded, true);
    }
});
