const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, required: true }, // e.g., 'Coffee', 'Appetizer'
    price: { type: Number, required: true },
    stock: { type: Number, default: 100 }
});

module.exports = mongoose.model('Product', ProductSchema);