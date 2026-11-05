const mongoose = require('mongoose');

const IngredientSchema = new mongoose.Schema({
    inventoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory' },
    name: String, amountPerServing: Number, unit: String,
    platterMultiplier: { type: Number, default: 3 },
});

const RecipeSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },
    productName: { type: String, required: true },
    ingredients: [IngredientSchema],
    optionRules: [{
        conditions: [{ type: { type: String, enum: ['variant', 'addon', 'portion'] }, group: String, option: String }],
        mode: { type: String, enum: ['replace', 'add'], default: 'replace' },
        ingredients: [IngredientSchema],
    }],
}, {
    collection: 'recipes',
    timestamps: true,
});

module.exports = mongoose.model('Recipe', RecipeSchema);
