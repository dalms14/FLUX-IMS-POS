const router = require('express').Router();
const InventoryCategory = require('../models/InventoryCategory');
const Inventory = require('../models/Inventory');
const SystemAudit = require('../models/SystemAudit');

const defaults = ['General', 'Batter', 'Bread', 'Coffee', 'Dairy', 'Fruit', 'Grain', 'Meat', 'Oil', 'Packaging', 'Pastry', 'Powder', 'Sauce', 'Seafood', 'Snack', 'Spice', 'Syrup', 'Tea', 'Topping', 'Utility', 'Vegetable', 'Other'];
const normalize = name => name.trim().replace(/\s+/g, ' ');

async function categoryNames() {
    const [saved, legacy] = await Promise.all([
        InventoryCategory.find({}).sort({ name: 1 }).lean(),
        Inventory.distinct('category'),
    ]);
    const unique = new Map();
    for (const name of [...defaults, ...saved.map(row => row.name), ...legacy]) {
        if (typeof name !== 'string' || !normalize(name)) continue;
        const clean = normalize(name);
        if (!unique.has(clean.toLowerCase())) unique.set(clean.toLowerCase(), clean);
    }
    return [...unique.values()];
}

router.get('/', async (req, res) => {
    try {
        res.json({ success: true, data: await categoryNames() });
    } catch (err) {
        res.status(500).json({ message: 'Could not load inventory categories.' });
    }
});

router.post('/', async (req, res) => {
    const name = typeof req.body?.name === 'string' ? normalize(req.body.name) : '';
    if (!name || name.length > 80) return res.status(400).json({ message: 'Enter a category name between 1 and 80 characters.' });
    try {
        const names = await categoryNames();
        if (names.some(existing => existing.toLowerCase() === name.toLowerCase())) {
            return res.status(409).json({ message: 'That category already exists. Choose it from the list.' });
        }
        const category = await InventoryCategory.create({ name, nameKey: name.toLowerCase() });
        // A logging failure must not report a successfully saved category as lost.
        try {
            await SystemAudit.create({ module: 'Inventory', action: 'Category Created', entityId: String(category._id), entityName: name,
                actor: req.user.name || req.user.email, actorEmail: req.user.email, details: 'Inventory category created', changes: { name } });
        } catch (err) { console.error('Inventory category audit error:', err.message); }
        res.status(201).json({ success: true, category: { name: category.name } });
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ message: 'That category already exists. Choose it from the list.' });
        res.status(500).json({ message: 'Could not save the category. Please try again.' });
    }
});

module.exports = router;
