const { test } = require('node:test');
const assert = require('node:assert/strict');
const { collectBackupRecords } = require('../services/backupExport');

test('backup includes every listed collection, not only products, and retains complete records', async t => {
    const names = { products: 'Product', categories: 'Category', addons: 'Addon', discounts: 'Discount', inventory: 'Inventory', transactions: 'Transaction', refunds: 'Refund', recipes: 'Recipe' };
    const expected = {};
    for (const [key, name] of Object.entries(names)) {
        expected[key] = key === 'refunds' ? [] : [{ _id: key, name: `Saved ${key}`, detail: { preserved: true } }];
        t.mock.method(require(`../models/${name}`), 'find', query => {
            assert.deepEqual(query, {});
            return { lean: async () => expected[key] };
        });
    }
    const backup = await collectBackupRecords();
    assert.deepEqual(backup.data, expected);
    assert.deepEqual(Object.keys(backup.counts), Object.keys(names));
    assert.equal(backup.counts.products, 1);
    assert.equal(backup.counts.recipes, 1);
    assert.equal(backup.counts.refunds, 0);
});
