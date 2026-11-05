const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateVariantPrices } = require('../middleware/variantPrices');

const validate = variantGroups => {
    let result = 'next';
    validateVariantPrices({ body: { variantGroups } }, { status(code) { this.code = code; return this; }, json(body) { result = { status: this.code, ...body }; } }, () => {});
    return result;
};
test('variant prices accept zero, cents, the maximum, and omitted prices', () => {
    assert.equal(validate(undefined), 'next');
    for (const price of [0, 5, 19.99, 9999.99, '0', '12.50', '', null]) {
        assert.equal(validate([{ name: 'Size', options: ['Large'], optionPrices: [price] }]), 'next');
    }
});
test('variant price validation rejects unbounded amounts, negatives, extra decimals and malformed values before saving', () => {
    for (const price of [10000, 9999999999, -1, 1.234, Infinity, '1e4', '0x100', 'abc', true, {}]) {
        const result = validate([{ options: ['Large'], optionPrices: [price] }]);
        assert.equal(result.status, 400);
        assert.equal(result.code, 'INVALID_VARIANT_PRICE');
    }
    assert.equal(validate([{ options: ['Large'], optionPrices: '999' }]).status, 400);
});
