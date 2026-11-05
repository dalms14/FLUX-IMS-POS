const mongoose = require('mongoose');
const Product = require('../models/Product');
const Discount = require('../models/Discount');

const money = value => Math.round(value * 100) / 100;
const invalid = message => { const error = new Error(message); error.status = 400; error.code = 'INVALID_CHECKOUT'; throw error; };
const changed = () => { const error = new Error('Product prices or discounts have changed. Refresh the POS and review the order before paying.'); error.status = 409; error.code = 'CHECKOUT_CHANGED'; throw error; };
const numeric = value => typeof value === 'number' && Number.isFinite(value);
const codeFor = name => /elite/i.test(name) ? 'elite' : /pwd|senior/i.test(name) ? 'pwd_senior' : /pag|ibig/i.test(name) ? 'pagibig' : 'custom_discount';

function variantGroups(product) {
    const groups = product.variantGroups?.length ? product.variantGroups : product.variants?.length ? [{ name: 'Flavor', options: product.variants, optionPrices: [] }] : [];
    return groups.filter(group => group.options?.length).map(group => ({
        name: group.name,
        options: group.options,
        prices: group.options.map((option, index) => group.optionPrices?.[index] ?? (/^drinks?$/i.test(product.category) && /^size$/i.test(group.name) && /^large$/i.test(option) ? 30 : 0)),
    }));
}

async function priceCheckout(body, { cancelled = false } = {}) {
    if (!Array.isArray(body.items) || body.items.length === 0) invalid('Order must contain at least one item.');
    const items = [];
    for (const raw of body.items) {
        if (!raw || typeof raw.productId !== 'string' || !mongoose.isObjectIdOrHexString(raw.productId)) invalid('Select a valid product.');
        if (!Number.isSafeInteger(raw.quantity) || raw.quantity <= 0) invalid('Item quantities must be positive whole numbers.');
        const product = await Product.findById(raw.productId).lean();
        if (!product || product.archived || product.available === false || product.status === 'unavailable') invalid('One or more products are no longer available.');
        const size = raw.size || 'solo';
        if (!['solo', 'platter'].includes(size) || size === 'platter' && product.platterPrice == null) invalid('This product size is unavailable.');
        const base = size === 'platter' ? product.platterPrice : product.soloPrice ?? product.price;
        if (!numeric(base) || base < 0) invalid('This product does not have a valid saved price.');
        const groups = variantGroups(product);
        const selections = raw.selectedVariantGroups || {};
        if (typeof selections !== 'object' || Array.isArray(selections) || Object.keys(selections).some(key => !groups.some(group => group.name === key))) invalid('Select a valid product variant.');
        const selectedVariantGroups = Object.create(null);
        let variantPrice = 0;
        for (const group of groups) {
            const option = selections[group.name] ?? group.options[0];
            const index = group.options.indexOf(option);
            if (index < 0 || !numeric(Number(group.prices[index])) || Number(group.prices[index]) < 0) invalid('Select a valid product variant.');
            selectedVariantGroups[group.name] = option;
            variantPrice += Number(group.prices[index]);
        }
        if (raw.upgrades !== undefined && !Array.isArray(raw.upgrades)) invalid('Select valid add-ons.');
        const upgrades = [];
        for (const requested of raw.upgrades || []) {
            const addon = product.addons?.find(item => item.name === requested?.name);
            if (!addon || upgrades.some(item => item.name === addon.name) || !numeric(Number(addon.price)) || Number(addon.price) < 0) invalid('An add-on is unavailable or selected more than once.');
            upgrades.push({ name: addon.name, price: Number(addon.price) });
        }
        const price = money(base + variantPrice + upgrades.reduce((sum, addon) => sum + addon.price, 0));
        const subtotal = money(price * raw.quantity);
        if (!Number.isSafeInteger(Math.round(subtotal * 100))) invalid('Order amount is too large.');
        if (raw.price !== undefined && (!numeric(raw.price) || money(raw.price) !== price)) changed();
        const eligible = raw.discountEligibleQuantity ?? 0;
        if (!Number.isSafeInteger(eligible) || eligible < 0 || eligible > raw.quantity) invalid('Discount quantities must be whole numbers within the ordered quantity.');
        // Mongoose Map casting requires a regular object. Keep the accumulator
        // prototype-free while building it, then materialize its own entries.
        items.push({ productId: product._id, name: product.name, category: product.category, size, selectedVariantGroups: Object.fromEntries(Object.entries(selectedVariantGroups)),
            selectedVariant: Object.entries(selectedVariantGroups).map(([key, value]) => `${key}: ${value}`).join(', '),
            variantPrice: money(variantPrice), upgrades, price, quantity: raw.quantity, subtotal, discountEligibleQuantity: eligible });
    }
    const customerType = body.customerType || 'customer';
    if (!['customer', 'elite', 'pwd_senior', 'pagibig', 'custom_discount'].includes(customerType)) invalid('Invalid customer discount type.');
    let discountInfo = null;
    if (customerType !== 'customer') {
        if (customerType === 'elite') discountInfo = { name: 'Elite Member', percentage: 20, scope: 'order', code: 'elite' };
        else {
            const nameKey = String(body.discountInfo?.name || '').trim().toLowerCase();
            const saved = nameKey ? await Discount.findOne({ nameKey, active: true }).lean() : null;
            if (!saved || codeFor(saved.name) !== customerType || !numeric(saved.percentage) || saved.percentage < 0 || saved.percentage > 100) invalid('This discount is unavailable.');
            discountInfo = { name: saved.name, percentage: saved.percentage, scope: ['item', 'order'].includes(saved.scope) ? saved.scope : ['pwd_senior', 'pagibig'].includes(customerType) ? 'item' : 'order', code: codeFor(saved.name) };
        }
    }
    const subtotal = money(items.reduce((sum, item) => sum + item.subtotal, 0));
    let base = subtotal;
    if (discountInfo?.scope === 'item') {
        let remaining = items.reduce((sum, item) => sum + item.discountEligibleQuantity, 0);
        if (remaining <= 0) invalid('Enter the number of eligible people before applying this discount.');
        // Preserve the existing one-highest-priced-unit-per-person workflow.
        for (const item of [...items].sort((a, b) => b.price - a.price)) {
            item.discountEligibleQuantity = Math.min(remaining, item.quantity);
            remaining -= item.discountEligibleQuantity;
        }
        base = items.reduce((sum, item) => sum + item.price * item.discountEligibleQuantity, 0);
    } else for (const item of items) item.discountEligibleQuantity = discountInfo ? item.quantity : 0;
    const discount = discountInfo ? Math.round(base * discountInfo.percentage / 100) : 0;
    const total = money(subtotal - discount);
    for (const [key, value] of Object.entries({ subtotal, discount, total, tax: 0 })) {
        if (body[key] !== undefined && (!numeric(body[key]) || money(body[key]) !== value)) changed();
    }
    const paymentMethod = cancelled ? 'Cancelled' : body.paymentMethod;
    if (!['Cash', 'GCash', 'Cancelled'].includes(paymentMethod) || !cancelled && paymentMethod === 'Cancelled') invalid('Choose Cash or GCash.');
    if (!cancelled && paymentMethod === 'Cash' && (!numeric(body.amountTendered) || money(body.amountTendered) < total)) invalid('Cash tendered must cover the order total.');
    const amountTendered = cancelled ? 0 : paymentMethod === 'GCash' ? total : money(body.amountTendered);
    return { items, customerType, discountInfo, subtotal, tax: 0, discount, total, paymentMethod, amountTendered, change: cancelled ? 0 : money(amountTendered - total) };
}

function authoritativeCheckout(cancelled = false) {
    return async (req, res, next) => {
        try { Object.assign(req.body, await priceCheckout(req.body, { cancelled })); return next(); }
        catch (err) {
            if (err.status) return res.status(err.status).json({ code: err.code, message: err.message });
            console.error('Checkout pricing failed:', err.message);
            return res.status(503).json({ message: 'Unable to verify product prices. Please try again.' });
        }
    };
}
module.exports = { priceCheckout, authoritativeCheckout };
