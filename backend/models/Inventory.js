const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
    name:        { type: String, required: true, unique: true },
    unit:        { type: String, required: true }, // 'ml', 'g', 'pcs'
    stock:       { type: Number, required: true, default: 0, min: 0 },
    lowStockAt:  { type: Number, default: 500 }, // warn when below this
    category:    { type: String, default: 'General' }, // e.g. 'Sauce', 'Meat', 'Spice'
    expirationDate: { type: Date, default: null },
    expirationBatches: [{
        quantity: { type: Number, required: true, min: 0 },
        expirationDate: { type: Date, default: null },
        receivedAt: { type: Date, default: Date.now },
        note: { type: String, default: '' },
    }],
}, {
    collection: 'inventory',
    timestamps: true,
});

module.exports = mongoose.model('Inventory', InventorySchema);
