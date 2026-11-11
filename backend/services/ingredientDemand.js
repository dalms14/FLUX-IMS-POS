const { addDays, businessDate, createForecast, MIN_HISTORY_DAYS } = require('./salesForecast');
const { resolveRecipe } = require('./recipeUsage');

const id = value => String(value?._id || value || '');
const round = value => Math.round(value * 1000) / 1000;
const unitKey = value => String(value || '').trim().toLowerCase();
const fail = message => { throw new Error(message); };

function configuration(item) {
    const selections = item.selectedVariantGroups instanceof Map
        ? Object.fromEntries(item.selectedVariantGroups) : item.selectedVariantGroups || {};
    return {
        size: item.size || 'solo',
        selectedVariantGroups: Object.fromEntries(Object.entries(selections).sort(([a], [b]) => a.localeCompare(b))),
        upgrades: (item.upgrades || []).map(row => ({ name: row.name })).sort((a, b) => a.name.localeCompare(b.name)),
    };
}

// Use the same current recipe rules as checkout, including portions and add-ons.
function recipeForConfiguration(recipe, item, product) {
    if (item.size === 'platter' && product.platterPrice == null) fail('A previously sold portion is no longer available.');
    const groups = product.variantGroups?.length ? product.variantGroups
        : product.variants?.length ? [{ name: 'Flavor', options: product.variants }] : [];
    for (const [group, option] of Object.entries(item.selectedVariantGroups)) {
        if (!groups.some(row => row.name === group && row.options?.includes(option))) fail('A previously sold variant is no longer available.');
    }
    if (groups.some(group => !Object.hasOwn(item.selectedVariantGroups, group.name))) fail('Some sales do not identify the current product variants.');
    if (item.upgrades.some(addon => !product.addons?.some(row => row.name === addon.name))) fail('A previously sold add-on is no longer available.');
    if (!recipe) fail('Configure an ingredient recipe for this product.');
    const usage = resolveRecipe(recipe, item, product);
    if (!usage.length) fail('The selected product options have no ingredient mapping.');
    return usage;
}

// Simulate each day in expiry order. This reads stock only; it never deducts it.
function projectStock(inventory, daily, today) {
    const stock = Number(inventory.stock);
    if (!Number.isFinite(stock) || stock < 0) fail('Correct the ingredient stock quantity.');
    let batchTotal = 0;
    const batches = (inventory.expirationBatches || []).map(batch => {
        const quantity = Number(batch.quantity);
        if (!Number.isFinite(quantity) || quantity < 0) fail('Correct the ingredient batch quantities.');
        const date = batch.expirationDate ? new Date(batch.expirationDate) : null;
        if (date && !Number.isFinite(date.getTime())) fail('Correct the ingredient expiration dates.');
        batchTotal += quantity;
        return { quantity, expires: date ? businessDate(date) : null };
    });
    if (batchTotal > stock + 0.001) fail('Ingredient batch quantities exceed recorded stock. Review the inventory record.');
    if (stock > batchTotal) batches.push({ quantity: stock - batchTotal, expires: null });
    // Older records may have one expiry date and no batch breakdown.
    if (!inventory.expirationBatches?.length && inventory.expirationDate) {
        const date = new Date(inventory.expirationDate);
        if (!Number.isFinite(date.getTime())) fail('Correct the ingredient expiration date.');
        batches.forEach(batch => { batch.expires = businessDate(date); });
    }
    let availableStock = 0;
    for (const batch of batches) {
        if (batch.expires && batch.expires < today) batch.quantity = 0;
        availableStock += batch.quantity;
    }
    batches.sort((a, b) => (a.expires || '9999').localeCompare(b.expires || '9999'));
    let shortfall = 0;
    let expiringUnused = 0;
    for (const day of daily) {
        for (const batch of batches) {
            if (batch.expires && batch.expires < day.date) {
                expiringUnused += batch.quantity;
                batch.quantity = 0;
            }
        }
        let required = day.quantity;
        for (const batch of batches) {
            const used = Math.min(required, batch.quantity);
            batch.quantity -= used;
            required -= used;
        }
        shortfall += Math.max(0, required);
    }
    return { availableStock: round(availableStock), shortfall: round(shortfall), expiringUnused: round(expiringUnused) };
}

function createIngredientDemand({ today, dates, transactions, products, recipes, inventory, source = 'real', isClosed = () => false }) {
    const productMap = new Map(products.map(product => [id(product._id), product]));
    const recipeMap = new Map(recipes.map(recipe => [id(recipe.productId), recipe]));
    const inventoryMap = new Map(inventory.map(item => [id(item._id), item]));
    const allowedDates = new Set(dates);
    const sold = new Map();
    const issues = [];
    const recentStart = addDays(today, -28);
    for (const transaction of transactions) {
        if (transaction.orderStatus !== 'completed' || transaction.paymentMethod === 'Cancelled') continue;
        const timestamp = new Date(transaction.createdAt);
        if (!Number.isFinite(timestamp.getTime())) continue;
        const date = businessDate(timestamp);
        if (!allowedDates.has(date)) continue;
        for (const item of transaction.items || []) {
            const productId = id(item.productId);
            const product = productMap.get(productId);
            if (product && (product.archived || product.available === false || product.status === 'unavailable')) continue;
            if (!product) { issues.push({ name: item.name || 'Unknown product', message: 'A sold product is missing from the catalog.' }); continue; }
            const quantity = Number(item.quantity);
            if (!Number.isSafeInteger(quantity) || quantity < 1) { issues.push({ name: product.name, message: 'Some sales contain invalid product quantities.' }); continue; }
            const entry = sold.get(productId) || { product, daily: new Map(), configurations: new Map() };
            entry.daily.set(date, (entry.daily.get(date) || 0) + quantity);
            if (date >= recentStart) {
                const choices = configuration(item);
                const key = JSON.stringify(choices);
                const mix = entry.configurations.get(key) || { choices, quantity: 0 };
                mix.quantity += quantity;
                entry.configurations.set(key, mix);
            }
            sold.set(productId, entry);
        }
    }
    const forecastDates = Array.from({ length: 7 }, (_, index) => addDays(today, index));
    const totals = new Map();
    const productForecasts = [];
    for (const [productId, entry] of sold) {
        // No recent sales gives no reliable current option mix, so do not extrapolate it.
        if (!entry.configurations.size) continue;
        try {
            const firstSale = [...entry.daily.keys()].sort()[0];
            const history = dates.filter(date => date >= firstSale).map(date => ({ date, sales: entry.daily.get(date) || 0 }));
            if (history.length < MIN_HISTORY_DAYS) fail(`At least ${MIN_HISTORY_DAYS} completed days since this product's first sale are needed.`);
            const prediction = createForecast(history, { today, source, isClosed });
            const mixQuantity = [...entry.configurations.values()].reduce((sum, row) => sum + row.quantity, 0);
            const dailyQuantities = prediction.forecast.map(day => day.sales);
            const productNeeds = new Map();
            for (const mix of entry.configurations.values()) {
                const usage = recipeForConfiguration(recipeMap.get(productId), mix.choices, entry.product);
                for (const ingredient of usage) {
                    const inventoryId = id(ingredient.inventoryId);
                    const stock = inventoryMap.get(inventoryId);
                    if (!stock || stock.archived) fail(`${ingredient.name || 'An ingredient'} is missing or archived. Update the recipe.`);
                    if (!unitKey(stock.unit) || unitKey(ingredient.unit) !== unitKey(stock.unit)) fail(`Correct the recipe unit for ${stock.name}; inventory uses ${stock.unit}.`);
                    const amount = Number(ingredient.quantityPerItem);
                    if (!Number.isFinite(amount) || amount <= 0) fail('Correct the ingredient quantities in the recipe.');
                    const daily = productNeeds.get(inventoryId) || Array(7).fill(0);
                    dailyQuantities.forEach((quantity, index) => { daily[index] += quantity * mix.quantity / mixQuantity * amount; });
                    productNeeds.set(inventoryId, daily);
                }
            }
            for (const [inventoryId, daily] of productNeeds) {
                const row = totals.get(inventoryId) || Array(7).fill(0);
                daily.forEach((amount, index) => { row[index] += amount; });
                totals.set(inventoryId, row);
            }
            productForecasts.push({ productId, name: entry.product.name, quantity: round(dailyQuantities.reduce((sum, quantity) => sum + quantity, 0)),
                historyDays: history.length, validation: prediction.validation });
        } catch (error) { issues.push({ name: entry.product.name, message: error.message }); }
    }
    const ingredients = [];
    for (const [inventoryId, amounts] of totals) {
        const item = inventoryMap.get(inventoryId);
        try {
            const daily = forecastDates.map((date, index) => ({ date, quantity: amounts[index] }));
            if (daily.some(day => !Number.isFinite(day.quantity))) fail('The ingredient estimate is outside the supported range.');
            ingredients.push({ inventoryId, name: item.name, unit: item.unit,
                estimatedDemand: round(amounts.reduce((sum, value) => sum + value, 0)),
                ...projectStock(item, daily, today), daily: daily.map(day => ({ ...day, quantity: round(day.quantity) })) });
        } catch (error) { issues.push({ name: item.name, message: error.message }); }
    }
    const uniqueIssues = [...new Map(issues.map(issue => [JSON.stringify(issue), issue])).values()];
    // Missing mappings must not turn a partial estimate into a misleading stock recommendation.
    return { source, status: uniqueIssues.length ? 'needs-review' : ingredients.length ? 'ready' : 'no-product-history',
        from: today, through: forecastDates.at(-1), historyDays: dates.length,
        ingredients: uniqueIssues.length ? [] : ingredients.sort((a, b) => b.shortfall - a.shortfall || a.name.localeCompare(b.name)),
        products: uniqueIssues.length ? [] : productForecasts, issues: uniqueIssues };
}

function demoIngredientDemand(today) {
    const products = [{ _id: 'demo-latte', name: 'Sample Latte', available: true }, { _id: 'demo-coffee', name: 'Sample Black Coffee', available: true }];
    const ingredient = (inventoryId, name, unit, amountPerServing) => ({ inventoryId, name, unit, amountPerServing });
    const recipes = [
        { productId: 'demo-latte', ingredients: [ingredient('demo-milk', 'Sample Milk', 'ml', 150), ingredient('demo-beans', 'Sample Coffee Beans', 'g', 18)] },
        { productId: 'demo-coffee', ingredients: [ingredient('demo-beans', 'Sample Coffee Beans', 'g', 18)] },
    ];
    const dates = Array.from({ length: 56 }, (_, index) => addDays(today, index - 56));
    const transactions = dates.map((date, index) => ({ createdAt: `${date}T12:00:00+08:00`, orderStatus: 'completed', paymentMethod: 'Cash',
        items: products.map((product, p) => ({ productId: product._id, quantity: (p ? 5 : 10) + new Date(`${date}T00:00:00Z`).getUTCDay() + Math.floor(index / 28) })) }));
    const inventory = [{ _id: 'demo-milk', name: 'Sample Milk', unit: 'ml', stock: 8000 }, { _id: 'demo-beans', name: 'Sample Coffee Beans', unit: 'g', stock: 6000 }];
    return createIngredientDemand({ today, dates, transactions, products, recipes, inventory, source: 'demo' });
}

module.exports = { createIngredientDemand, demoIngredientDemand, projectStock };
