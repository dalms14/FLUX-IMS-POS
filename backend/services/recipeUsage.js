const mongoose = require('mongoose');
const Recipe = require('../models/Recipe');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');

const roundStock = value => Math.round(value * 1000) / 1000;
const keyOf = value => String(value?._id || value || '');
const invalid = message => { throw Object.assign(new Error(message), { status: 400, code: 'INVALID_RECIPE' }); };
const decimal = (value, allowZero, max = 1000000) => {
    const amount = Number(value);
    if (!['string', 'number'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(amount)
        || amount < (allowZero ? 0 : 0.001) || amount > max || Math.abs(amount * 1000 - Math.round(amount * 1000)) > 0.00001) {
        invalid(`Ingredient amounts must be ${allowZero ? '0' : 'greater than 0'} to ${max.toLocaleString('en-US')}, with up to three decimal places.`);
    }
    return amount;
};

function productChoices(product) {
    const groups = product.variantGroups?.length ? product.variantGroups : product.variants?.length ? [{ name: 'Flavor', options: product.variants }] : [];
    return [
        ...groups.flatMap(group => (group.options || []).map(option => ({ type: 'variant', group: group.name, option }))),
        ...(product.addons || []).map(addon => ({ type: 'addon', option: addon.name })),
        { type: 'portion', option: 'solo' },
        ...(product.platterPrice != null ? [{ type: 'portion', option: 'platter' }] : []),
    ];
}
const conditionKey = condition => JSON.stringify([condition.type, condition.group || '', condition.option]);

function validateRules(rules, product) {
    if (!Array.isArray(rules) || rules.length > 50) invalid('Use no more than 50 option ingredient rules.');
    const choices = new Set(productChoices(product).map(conditionKey));
    const ruleKeys = new Set();
    return rules.map(rule => {
        if (!rule || !['replace', 'add'].includes(rule.mode) || !Array.isArray(rule.conditions) || !rule.conditions.length || rule.conditions.length > 8
            || !Array.isArray(rule.ingredients) || !rule.ingredients.length || rule.ingredients.length > 200) invalid('Each option rule needs an option, an action and at least one ingredient.');
        const fields = new Set();
        const conditions = rule.conditions.map(condition => {
            if (!condition || !choices.has(conditionKey(condition))) invalid('An ingredient rule refers to a size, variant or add-on that is no longer available. Update that rule.');
            const field = condition.type === 'variant' ? `variant:${condition.group}` : condition.type === 'addon' ? `addon:${condition.option}` : 'portion';
            if (fields.has(field)) invalid('Choose each variant group or add-on only once in a rule.');
            fields.add(field);
            return { type: condition.type, ...(condition.type === 'variant' ? { group: condition.group } : {}), option: condition.option };
        });
        const ruleKey = JSON.stringify([rule.mode, conditions.map(conditionKey).sort()]);
        if (ruleKeys.has(ruleKey)) invalid('Combine duplicate option rules into one ingredient list.');
        ruleKeys.add(ruleKey);
        return { mode: rule.mode, conditions, ingredients: rule.ingredients };
    });
}

async function normalizeRecipe(product, body) {
    if (!Array.isArray(body.ingredients) || body.ingredients.length > 200) invalid('Ingredients must be a list of no more than 200 entries.');
    const rules = body.optionRules === undefined ? undefined : validateRules(body.optionRules, product);
    const entries = [...body.ingredients, ...(rules || []).flatMap(rule => rule.ingredients)];
    if (entries.some(row => !row || !mongoose.isValidObjectId(keyOf(row.inventoryId)))) invalid('Select a valid inventory ingredient.');
    const ids = [...new Set(entries.map(row => keyOf(row.inventoryId)))];
    const inventory = ids.length ? await Inventory.find({ _id: { $in: ids } }).lean() : [];
    const inventoryMap = new Map(inventory.map(row => [keyOf(row._id), row]));
    const normalize = (rows, allowZero) => {
        const seen = new Set();
        return rows.map(row => {
            const source = inventoryMap.get(keyOf(row.inventoryId));
            if (!source || source.archived) invalid('One or more ingredients are missing or archived. Select an active ingredient.');
            if (seen.has(keyOf(source._id))) invalid('List an ingredient only once in each recipe or rule.');
            seen.add(keyOf(source._id));
            return { inventoryId: source._id, name: source.name, unit: source.unit,
                amountPerServing: decimal(row.amountPerServing, allowZero), platterMultiplier: decimal(row.platterMultiplier ?? 3, false, 1000) };
        });
    };
    return { ingredients: normalize(body.ingredients, false), ...(rules === undefined ? {} : { optionRules: rules.map(rule => ({ ...rule, ingredients: normalize(rule.ingredients, rule.mode === 'replace') })) }) };
}

function ruleMatches(rule, item) {
    const selections = item.selectedVariantGroups instanceof Map ? Object.fromEntries(item.selectedVariantGroups) : item.selectedVariantGroups || {};
    return rule.conditions.every(condition => condition.type === 'variant' ? selections[condition.group] === condition.option
        : condition.type === 'addon' ? (item.upgrades || []).some(addon => addon.name === condition.option)
            : (item.size || 'solo') === condition.option);
}

function resolveRecipe(recipe, item, product) {
    const rules = recipe.optionRules?.length ? validateRules(recipe.optionRules, product) : [];
    const perPortion = ingredient => {
        const amount = decimal(ingredient.amountPerServing, true);
        // Legacy rows without a multiplier previously used the solo amount.
        // New and edited recipes explicitly save their configured multiplier.
        const multiplier = item.size === 'platter' ? decimal(ingredient.platterMultiplier ?? 1, false, 1000) : 1;
        return roundStock(amount * multiplier);
    };
    const amounts = new Map();
    for (const ingredient of recipe.ingredients || []) {
        const key = keyOf(ingredient.inventoryId);
        if (!key) invalid('An ingredient is missing from the recipe. Update the product recipe.');
        amounts.set(key, { inventoryId: ingredient.inventoryId, name: ingredient.name, unit: ingredient.unit, quantityPerItem: perPortion(ingredient) });
    }
    const matches = rules.filter(rule => ruleMatches(rule, item));
    // Process most-specific rules first so combination rules resolve broader overlaps.
    matches.sort((a, b) => b.conditions.length - a.conditions.length);
    const replacements = new Map();
    for (const rule of matches.filter(rule => rule.mode === 'replace')) {
        for (const ingredient of rule.ingredients) {
            const key = keyOf(ingredient.inventoryId);
            const previous = replacements.get(key);
            const amount = perPortion(ingredient);
            if (!previous || rule.conditions.length > previous.specificity) replacements.set(key, { ingredient, amount, specificity: rule.conditions.length });
            else if (rule.conditions.length === previous.specificity && amount !== previous.amount) invalid(`Conflicting ingredient amounts for ${ingredient.name}. Add a more specific combination rule or use extra amounts.`);
        }
    }
    for (const [key, entry] of replacements) amounts.set(key, { inventoryId: entry.ingredient.inventoryId, name: entry.ingredient.name, unit: entry.ingredient.unit, quantityPerItem: entry.amount });
    for (const rule of matches.filter(rule => rule.mode === 'add')) {
        for (const ingredient of rule.ingredients) {
            const key = keyOf(ingredient.inventoryId);
            const previous = amounts.get(key);
            amounts.set(key, { inventoryId: ingredient.inventoryId, name: ingredient.name, unit: ingredient.unit,
                quantityPerItem: roundStock((previous?.quantityPerItem || 0) + perPortion(ingredient)) });
        }
    }
    return [...amounts.values()].filter(row => row.quantityPerItem > 0);
}

async function buildInventoryRequirements(items, { useSnapshots = false } = {}) {
    const requirements = new Map();
    const recipes = new Map();
    for (const item of items) {
        if (!item.productId) continue;
        const quantity = Number(item.quantity);
        if (!Number.isSafeInteger(quantity) || quantity < 1) invalid('Use a positive whole-number order quantity.');
        let usage;
        if (useSnapshots && item.inventoryUsageRecorded === true) usage = item.inventoryUsage || [];
        else {
            const key = keyOf(item.productId);
            if (!recipes.has(key)) {
                const recipe = await Recipe.findOne({ productId: item.productId }).lean();
                const product = recipe?.optionRules?.length ? await Product.findById(item.productId).lean() : {};
                if (!product) invalid('The product for this recipe no longer exists.');
                recipes.set(key, { recipe, product });
            }
            const { recipe, product } = recipes.get(key);
            usage = recipe ? resolveRecipe(recipe, item, product) : [];
            item.inventoryUsage = usage;
            item.inventoryUsageRecorded = true;
        }
        for (const ingredient of usage) {
            const required = roundStock(Number(ingredient.quantityPerItem) * quantity);
            if (!Number.isFinite(required) || required < 0) invalid('Invalid saved ingredient usage.');
            if (!required) continue;
            const key = keyOf(ingredient.inventoryId);
            const entry = requirements.get(key) || { inventoryId: ingredient.inventoryId, name: ingredient.name, unit: ingredient.unit, required: 0, products: [] };
            if (entry.unit !== ingredient.unit) invalid('Ingredient units do not match. Update the recipe before checkout.');
            entry.required = roundStock(entry.required + required);
            entry.products.push(item.name || 'Product');
            requirements.set(key, entry);
        }
    }
    return [...requirements.values()];
}

module.exports = { normalizeRecipe, resolveRecipe, buildInventoryRequirements, productChoices };
