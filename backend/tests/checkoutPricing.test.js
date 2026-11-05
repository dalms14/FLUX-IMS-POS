const { test } = require('node:test');
const assert = require('node:assert/strict');
const Product = require('../models/Product');
const Discount = require('../models/Discount');
const Transaction = require('../models/Transaction');
const { priceCheckout } = require('../services/checkoutPricing');
const id = '012345678901234567890123';
const product = { _id: id, name: 'Coffee', category: 'Drinks', soloPrice: 100, addons: [{ name: 'Milk', price: 30 }], variantGroups: [{ name: 'Size', options: ['Regular', 'Large'], optionPrices: [0, 30] }] };
const order = () => ({ paymentMethod: 'Cash', amountTendered: 1000, items: [{ productId: id, price: 100, quantity: 2, size: 'solo' }] });
const mockProducts = t => t.mock.method(Product, 'findById', () => ({ lean: async () => product }));

test('saved prices, selected variants and add-ons determine totals, cash change and canonical receipt items', async t => {
    mockProducts(t);
    const body = order();
    Object.assign(body.items[0], { price: 160, selectedVariantGroups: { Size: 'Large' }, upgrades: [{ name: 'Milk', price: 0 }] });
    const quote = await priceCheckout(body);
    assert.equal(quote.total, 320);
    assert.equal(quote.change, 680);
    assert.equal(quote.items[0].upgrades[0].price, 30);
    assert.equal(quote.items[0].name, 'Coffee');
});

test('forged prices, totals, fractional quantities, unsupported options and inadequate tender cannot be checked out', async t => {
    mockProducts(t);
    for (const mutate of [
        body => { body.items[0].price = 1; },
        body => { body.total = 0; },
        body => { body.items[0].quantity = -1; },
        body => { body.items[0].quantity = 1.5; },
        body => { body.items[0].selectedVariantGroups = { Size: 'Free XL' }; },
        body => { body.items[0].upgrades = [{ name: 'Unknown', price: 0 }]; },
        body => { body.amountTendered = 1; },
    ]) {
        const body = order(); mutate(body);
        await assert.rejects(priceCheckout(body), err => [400, 409].includes(err.status));
    }
});

test('discount percentage comes from the saved discount and item eligibility is bounded and allocated by unit price', async t => {
    mockProducts(t);
    t.mock.method(Discount, 'findOne', () => ({ lean: async () => ({ name: 'PWD/Senior Citizen', percentage: 20, scope: 'item' }) }));
    const body = order();
    Object.assign(body, { customerType: 'pwd_senior', discountInfo: { name: 'PWD/Senior Citizen', percentage: 99 } });
    body.items[0].discountEligibleQuantity = 1;
    const quote = await priceCheckout(body);
    assert.equal(quote.discount, 20);
    assert.equal(quote.total, 180);
    body.items[0].discountEligibleQuantity = 3;
    await assert.rejects(priceCheckout(body), /Discount quantities/);
});

test('legacy Drinks Large pricing and GCash tender remain compatible; cancelled checkout uses canonical totals', async t => {
    const legacy = { ...product, variantGroups: [{ name: 'Size', options: ['Regular', 'Large'], optionPrices: [] }] };
    t.mock.method(Product, 'findById', () => ({ lean: async () => legacy }));
    const body = order();
    Object.assign(body.items[0], { price: 130, selectedVariantGroups: { Size: 'Large' } });
    body.paymentMethod = 'GCash';
    body.amountTendered = -100;
    const quote = await priceCheckout(body);
    assert.equal(quote.total, 260);
    assert.equal(quote.amountTendered, 260);
    assert.equal(quote.change, 0);
    const cancelled = await priceCheckout(body, { cancelled: true });
    assert.equal(cancelled.total, 260);
    assert.equal(cancelled.paymentMethod, 'Cancelled');
});

test('canonical checkout items validate against the actual transaction model with and without variant groups', async t => {
    let saved = product;
    t.mock.method(Product, 'findById', () => ({ lean: async () => saved }));
    for (const groups of [[], [{ name: 'Flavor', options: ['Garlic Parmesan'], optionPrices: [0] }, { name: 'Parts', options: ['Legs'], optionPrices: [0] }]]) {
        saved = { ...product, variantGroups: groups };
        for (const paymentMethod of ['Cash', 'GCash', 'Cancelled']) {
            const body = { ...order(), paymentMethod };
            const checkout = await priceCheckout(body, { cancelled: paymentMethod === 'Cancelled' });
            const document = new Transaction({ ...checkout, receiptNo: 'VALIDATION-ONLY', cashier: 'Owner', orderStatus: paymentMethod === 'Cancelled' ? 'cancelled' : 'completed' });
            assert.equal(document.validateSync(), undefined);
            await document.validate();
            assert.deepEqual(Object.fromEntries(document.items[0].selectedVariantGroups), groups.length ? { Flavor: 'Garlic Parmesan', Parts: 'Legs' } : {});
            assert.equal(checkout.total, 200);
        }
    }
});
