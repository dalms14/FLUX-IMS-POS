const { test } = require('node:test');
const assert = require('node:assert/strict');
const Recipe = require('../models/Recipe');
const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const { resolveRecipe, normalizeRecipe, buildInventoryRequirements } = require('../services/recipeUsage');
const id = '012345678901234567890123';
const milkId = '012345678901234567890124';
const product = { variantGroups: [{ name: 'Size', options: ['Regular', 'Large'] }, { name: 'Flavor', options: ['Vanilla'] }], addons: [{ name: 'Milk' }], platterPrice: 300 };
const bean = (amount = 18) => ({ inventoryId: id, name: 'Coffee beans', unit: 'g', amountPerServing: amount, platterMultiplier: 3 });
const large = { type: 'variant', group: 'Size', option: 'Large' };
const vanilla = { type: 'variant', group: 'Flavor', option: 'Vanilla' };
const milk = { type: 'addon', option: 'Milk' };
const rule = (conditions, amount, mode = 'replace') => ({ conditions, mode, ingredients: [bean(amount)] });
const order = (size = 'solo') => ({ productId: id, name: 'Coffee', quantity: 2, size, selectedVariantGroups: { Size: 'Large', Flavor: 'Vanilla' }, upgrades: [{ name: 'Milk' }] });

test('base recipes retain solo and platter usage; matching sizes replace amounts and add-ons add extras', () => {
    const recipe = { ingredients: [bean()], optionRules: [rule([large], 24), { conditions: [milk], mode: 'add', ingredients: [{ ...bean(50), inventoryId: milkId, name: 'Milk', unit: 'ml' }] }] };
    assert.equal(resolveRecipe({ ingredients: [bean()] }, order(), product)[0].quantityPerItem, 18);
    assert.equal(resolveRecipe({ ingredients: [{ ...bean(), platterMultiplier: undefined }] }, order('platter'), product)[0].quantityPerItem, 18);
    const usage = resolveRecipe(recipe, order('platter'), product);
    assert.deepEqual(usage.map(row => row.quantityPerItem), [72, 150]);
    assert.equal(resolveRecipe(recipe, { ...order(), selectedVariantGroups: { Size: 'Regular' }, upgrades: [] }, product)[0].quantityPerItem, 18);
});

test('combination rules resolve broader conflicts irrespective of order; unresolved conflicts fail safely', () => {
    const broad = [rule([large], 24), rule([vanilla], 20)];
    assert.throws(() => resolveRecipe({ ingredients: [bean()], optionRules: broad }, order(), product), /Conflicting/);
    for (const rules of [[...broad, rule([large, vanilla], 28)], [rule([large, vanilla], 28), ...broad]]) {
        assert.equal(resolveRecipe({ ingredients: [bean()], optionRules: rules }, order(), product)[0].quantityPerItem, 28);
    }
    assert.equal(resolveRecipe({ ingredients: [bean()], optionRules: [rule([large], 0)] }, order(), product).length, 0);
    assert.equal(resolveRecipe({ ingredients: [bean(0.125)], optionRules: [rule([milk], 0.025, 'add')] }, order(), product)[0].quantityPerItem, 0.15);
});

test('recipe writes use active inventory identity and units and reject invalid or obsolete rules', async t => {
    t.mock.method(Inventory, 'find', () => ({ lean: async () => [{ _id: id, name: 'Actual beans', unit: 'g' }] }));
    const result = await normalizeRecipe(product, { ingredients: [{ ...bean(), unit: 'ml', name: 'Forged' }], optionRules: [rule([large], 0)] });
    assert.equal(result.ingredients[0].unit, 'g');
    assert.equal(result.ingredients[0].name, 'Actual beans');
    assert.equal(result.optionRules[0].ingredients[0].amountPerServing, 0);
    assert.equal(Object.hasOwn(await normalizeRecipe(product, { ingredients: [] }), 'optionRules'), false);
    for (const body of [
        { ingredients: [bean(0)] }, { ingredients: [bean(-1)] }, { ingredients: [bean('')] }, { ingredients: [bean(0.0001)] },
        { ingredients: [bean(), bean()] }, { ingredients: [{ ...bean(), inventoryId: milkId }] },
        { ingredients: [], optionRules: [rule([{ ...large, option: 'Removed' }], 20)] },
        { ingredients: [], optionRules: [rule([large], 20), rule([large], 25)] },
        { ingredients: [], optionRules: [rule([milk], 0, 'add')] },
    ]) await assert.rejects(normalizeRecipe(product, body), err => err.code === 'INVALID_RECIPE');
});

test('archived ingredients cannot be assigned to a new recipe', async t => {
    t.mock.method(Inventory, 'find', () => ({ lean: async () => [{ _id: id, name: 'Beans', unit: 'g', archived: true }] }));
    await assert.rejects(normalizeRecipe(product, { ingredients: [bean()] }), /archived/);
});

test('mixed options aggregate exact stock; trusted snapshots replace client values and survive later recipe edits', async t => {
    t.mock.method(Recipe, 'findOne', () => ({ lean: async () => ({ ingredients: [bean()], optionRules: [rule([large], 24)] }) }));
    t.mock.method(Product, 'findById', () => ({ lean: async () => product }));
    const items = [order(), { ...order(), quantity: 1, selectedVariantGroups: { Size: 'Regular' } }];
    items[0].inventoryUsageRecorded = true;
    items[0].inventoryUsage = [{ ...bean(), quantityPerItem: 0 }];
    const requirements = await buildInventoryRequirements(items);
    assert.equal(requirements[0].required, 66);
    assert.equal(items[0].inventoryUsage[0].quantityPerItem, 24);
    const saved = new Transaction({ receiptNo: 'TEST', cashier: 'Owner', items, subtotal: 100, total: 100, paymentMethod: 'Cash' });
    assert.equal(saved.validateSync(), undefined);
    assert.equal(saved.items[0].inventoryUsageRecorded, true);
    t.mock.method(Recipe, 'findOne', () => { throw new Error('Must not read edited recipe'); });
    const restore = await buildInventoryRequirements([{ ...saved.toObject().items[0], quantity: 1 }], { useSnapshots: true });
    assert.equal(restore[0].required, 24);
});

test('recipe model preserves rule conditions and zero replacement amounts', () => {
    const recipe = new Recipe({ productId: id, productName: 'Coffee', ingredients: [bean()], optionRules: [rule([large], 0)] });
    assert.equal(recipe.validateSync(), undefined);
    assert.equal(recipe.toObject().optionRules[0].conditions[0].type, 'variant');
    assert.equal(recipe.toObject().optionRules[0].ingredients[0].amountPerServing, 0);
});
