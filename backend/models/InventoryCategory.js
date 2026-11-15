const mongoose = require('mongoose');

const inventoryCategorySchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 80 },
    nameKey: { type: String, required: true, unique: true },
}, { timestamps: true });

module.exports = mongoose.model('InventoryCategory', inventoryCategorySchema);
