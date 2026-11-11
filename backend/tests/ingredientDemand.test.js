const { test } = require('node:test');
const assert = require('node:assert/strict');
const { addDays, businessDate } = require('../services/salesForecast');
const { createIngredientDemand, demoIngredientDemand, projectStock } = require('../services/ingredientDemand');
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const Recipe = require('../models/Recipe');
const Inventory = require('../models/Inventory');
const router = require('../Routes/salesForecastRoutes');
const today = '2026-11-11';
const productId = '012345678901234567890123';
const milkId = '012345678901234567890124';
const ingredient = { inventoryId: milkId, name: 'Milk', unit: 'ml', amountPerServing: 100, platterMultiplier: 3 };
function fixture() {
    const dates = Array.from({ length: 56 }, (_, index) => addDays(today, index - 56));
    return { today, dates, source: 'real',
        products: [{ _id: productId, name: 'Latte', available: true }],
        recipes: [{ productId, ingredients: [ingredient] }],
        inventory: [{ _id: milkId, name: 'Milk', unit: 'ml', stock: 1000 }],
        transactions: dates.map(date => ({ createdAt: `${date}T12:00:00+08:00`, orderStatus: 'completed', paymentMethod: 'Cash',
            items: [{ productId, name: 'Latte', quantity: 2 }] })),
    };
}

test('forecasts product quantities and maps them to ingredient needs without changing stock', () => {
    const input = fixture();
    const original = structuredClone(input);
    const result = createIngredientDemand(input);
    assert.equal(result.status, 'ready');
    assert.equal(result.products[0].quantity, 14);
    assert.equal(result.products[0].validation.modelMae, 0);
    assert.equal(result.ingredients[0].estimatedDemand, 1400);
    assert.equal(result.ingredients[0].availableStock, 1000);
    assert.equal(result.ingredients[0].shortfall, 400);
    assert.deepEqual(input, original);
    assert.equal(result.ingredients[0].daily.length, 7);
});

test('uses current variant, add-on and platter recipe amounts with the recent sales mix', () => {
    const input = fixture();
    input.products[0] = { ...input.products[0], platterPrice: 300, variantGroups: [{ name: 'Size', options: ['Regular', 'Large'] }], addons: [{ name: 'Milk' }] };
    input.recipes[0].optionRules = [
        { mode: 'replace', conditions: [{ type: 'variant', group: 'Size', option: 'Large' }], ingredients: [{ ...ingredient, amountPerServing: 150 }] },
        { mode: 'add', conditions: [{ type: 'addon', option: 'Milk' }], ingredients: [{ ...ingredient, amountPerServing: 20 }] },
    ];
    for (const transaction of input.transactions) transaction.items = [
        { productId, quantity: 1, selectedVariantGroups: { Size: 'Regular' } },
        { productId, quantity: 1, size: 'platter', selectedVariantGroups: { Size: 'Large' }, upgrades: [{ name: 'Milk' }] },
    ];
    const result = createIngredientDemand(input);
    assert.equal(result.status, 'ready');
    // Each day: 100 regular + (150 + 20) * 3 platter = 610 ml.
    assert.equal(result.ingredients[0].estimatedDemand, 4270);
});

test('ignores cancelled, current-day and pre-window sales; refunds retain consumed demand', () => {
    const input = fixture();
    const extra = (createdAt, orderStatus, paymentMethod) => ({ ...structuredClone(input.transactions[0]), createdAt, orderStatus, paymentMethod,
        items: [{ productId, quantity: 9000 }] });
    input.transactions.push(extra(`${today}T00:00:00+08:00`, 'completed', 'Cash'),
        extra(`${addDays(today, -57)}T23:00:00+08:00`, 'completed', 'Cash'),
        extra(`${addDays(today, -1)}T12:00:00+08:00`, 'cancelled', 'Cancelled'));
    input.transactions[0].refundVersion = 2;
    assert.equal(createIngredientDemand(input).ingredients[0].estimatedDemand, 1400);
});

test('uses Philippine dates and predicts no consumption on scheduled closures', () => {
    const input = fixture();
    input.transactions.forEach((transaction, index) => { transaction.createdAt = `${addDays(input.dates[index], -1)}T16:30:00Z`; });
    input.isClosed = date => date === addDays(today, 2);
    const result = createIngredientDemand(input);
    assert.equal(result.ingredients[0].estimatedDemand, 1200);
    assert.equal(result.ingredients[0].daily[2].quantity, 0);
});

test('expired stock is excluded and batches are consumed in expiry order across the week', () => {
    const daily = Array.from({ length: 7 }, (_, index) => ({ date: addDays(today, index), quantity: 100 }));
    const inventory = { stock: 900, expirationBatches: [
        { quantity: 200, expirationDate: addDays(today, -1) },
        { quantity: 500, expirationDate: today },
        { quantity: 200, expirationDate: addDays(today, 10) },
    ] };
    assert.deepEqual(projectStock(inventory, daily, today), { availableStock: 700, shortfall: 400, expiringUnused: 400 });
    // A batch remains usable on its expiration date; no stock is written back.
    assert.equal(inventory.expirationBatches[1].quantity, 500);
    assert.equal(projectStock({ stock: 100, expirationDate: addDays(today, -1) }, daily, today).availableStock, 0);
    assert.throws(() => projectStock({ stock: 10, expirationBatches: [{ quantity: 20 }] }, daily, today), /exceed/);
});

test('missing recipes, mismatched units and incomplete product history never produce partial purchase advice', () => {
    for (const alter of [
        input => { input.recipes = []; },
        input => { input.inventory[0].unit = 'g'; },
        input => { input.inventory[0].archived = true; },
        input => { input.transactions = input.transactions.slice(-20); },
        input => { input.transactions[0].items[0].quantity = -1; },
        input => { input.products[0].variantGroups = [{ name: 'Size', options: ['Large'] }]; },
    ]) {
        const input = fixture(); alter(input);
        const result = createIngredientDemand(input);
        assert.equal(result.status, 'needs-review');
        assert.deepEqual(result.ingredients, []);
        assert.ok(result.issues.length);
    }
});

test('archived and unavailable products are excluded from future demand', () => {
    for (const unavailable of [{ archived: true }, { available: false }, { status: 'unavailable' }]) {
        const input = fixture(); Object.assign(input.products[0], unavailable);
        const result = createIngredientDemand(input);
        assert.equal(result.status, 'no-product-history');
        assert.deepEqual(result.ingredients, []);
    }
});

test('demonstration estimates use isolated sample products, recipes and stock', () => {
    const result = demoIngredientDemand(today);
    assert.deepEqual(result, demoIngredientDemand(today));
    assert.equal(result.status, 'ready');
    assert.equal(result.source, 'demo');
    assert.ok(result.ingredients.every(item => item.name.startsWith('Sample ') && item.inventoryId.startsWith('demo-')));
    assert.ok(result.products.every(item => item.name.startsWith('Sample ')));
});

const invoke = async source => {
    let status = 200, data;
    const route = router.stack.find(layer => layer.route?.path === '/ingredient-demand');
    await route.route.stack[0].handle({ query: { source } }, { status(code) { status = code; return this; }, json(value) { data = value; return this; } });
    return { status, data };
};
const envKeys = ['FORECAST_REAL_SALES_START_DATE', 'FORECAST_CLOSED_WEEKDAYS', 'FORECAST_CLOSED_DATES'];
function environment(t, start) {
    const previous = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
    envKeys.forEach(key => { delete process.env[key]; });
    if (start) process.env.FORECAST_REAL_SALES_START_DATE = start;
    t.after(() => envKeys.forEach(key => { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }));
}

test('demo, unconfigured real mode and invalid requests never query operational data', async t => {
    environment(t);
    for (const model of [Transaction, Product, Recipe, Inventory]) t.mock.method(model, 'find', () => { throw new Error('Unexpected database access'); });
    t.mock.method(Transaction, 'aggregate', () => { throw new Error('Unexpected database access'); });
    assert.equal((await invoke('demo')).data.status, 'ready');
    assert.equal((await invoke('real')).data.status, 'awaiting-real-sales');
    assert.equal((await invoke('other')).status, 400);
});

test('real endpoint restricts history to verified completed days and returns mapped demand', async t => {
    const current = businessDate();
    environment(t, addDays(current, -56));
    const input = fixture();
    input.dates = Array.from({ length: 56 }, (_, index) => addDays(current, index - 56));
    input.transactions.forEach((transaction, index) => { transaction.createdAt = `${input.dates[index]}T12:00:00+08:00`; });
    const checkFilter = filter => {
        assert.equal(filter.orderStatus, 'completed');
        assert.equal(filter.paymentMethod.$ne, 'Cancelled');
        assert.equal(filter.createdAt.$gte.toISOString(), new Date(`${addDays(current, -56)}T00:00:00+08:00`).toISOString());
        assert.equal(filter.createdAt.$lt.toISOString(), new Date(`${current}T00:00:00+08:00`).toISOString());
    };
    t.mock.method(Transaction, 'aggregate', async pipeline => { checkFilter(pipeline[0].$match); return input.dates.map(date => ({ _id: date, count: 1 })); });
    const query = value => ({ select() { return this; }, lean: async () => value });
    t.mock.method(Transaction, 'find', filter => { checkFilter(filter); return query(input.transactions); });
    t.mock.method(Product, 'find', () => query(input.products));
    t.mock.method(Recipe, 'find', () => query(input.recipes));
    t.mock.method(Inventory, 'find', () => query(input.inventory));
    const result = await invoke('real');
    assert.equal(result.status, 200);
    assert.equal(result.data.source, 'real');
    assert.equal(result.data.ingredients[0].estimatedDemand, 1400);
});

test('unconfirmed missing days block real ingredient estimates', async t => {
    environment(t, addDays(businessDate(), -56));
    t.mock.method(Transaction, 'aggregate', async () => []);
    t.mock.method(Transaction, 'find', () => ({ select() { return this; }, lean: async () => [] }));
    t.mock.method(Inventory, 'find', () => { throw new Error('Must not read stock with incomplete history'); });
    assert.equal((await invoke('real')).data.status, 'incomplete-history');
});
