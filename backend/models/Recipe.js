const mongoose = require('mongoose');

const RecipeSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },
    productName: { type: String, required: true },
    ingredients: [{
        inventoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory' },
        name:        String,
        amountPerServing: Number, // amount used per 1 solo serving
        unit:        String,
        platterMultiplier: { type: Number, default: 3 }, // platter = solo x 3
    }],
}, {
    collection: 'recipes',
    timestamps: true,
});

module.exports = mongoose.model('Recipe', RecipeSchema);