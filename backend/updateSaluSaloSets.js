require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');
const Inventory = require('./models/Inventory');
const Recipe = require('./models/Recipe');

const setProducts = {
    'Couple Set A': {
        description: 'Includes 1 Hawaiian Pizza, 1 Honey Glazed Chicken, 1 Carbonara, and 1L Lemon Iced Tea.',
        recipe: [
            ['Pizza Dough', 1, 'pcs', 'Bread'],
            ['Pizza Sauce', 60, 'ml', 'Sauce'],
            ['Mozzarella Cheese', 90, 'g', 'Dairy'],
            ['Ham', 45, 'g', 'Meat'],
            ['Pineapple', 45, 'g', 'Fruit'],
            ['Chicken', 220, 'g', 'Meat'],
            ['Honey Glaze', 45, 'ml', 'Sauce'],
            ['Cooking Oil', 35, 'ml', 'Oil'],
            ['Pasta Noodles', 180, 'g', 'Grain'],
            ['Cream Sauce', 100, 'ml', 'Sauce'],
            ['Bacon Bits', 40, 'g', 'Meat'],
            ['Tea Base', 700, 'ml', 'Tea'],
            ['Lemon Concentrate', 120, 'ml', 'Syrup'],
            ['Ice', 250, 'g', 'Utility'],
        ],
    },
    'Couple Set B': {
        description: 'Includes 1 Pepperoni Pizza, 1 Garlic Parmesan Chicken, 1 Tuna Pesto, and 1L Cucumber Lemonade.',
        recipe: [
            ['Pizza Dough', 1, 'pcs', 'Bread'],
            ['Pizza Sauce', 60, 'ml', 'Sauce'],
            ['Mozzarella Cheese', 90, 'g', 'Dairy'],
            ['Pepperoni', 60, 'g', 'Meat'],
            ['Chicken', 220, 'g', 'Meat'],
            ['Garlic Parmesan Mix', 25, 'g', 'Spice'],
            ['Cooking Oil', 35, 'ml', 'Oil'],
            ['Pasta Noodles', 180, 'g', 'Grain'],
            ['Tuna', 80, 'g', 'Meat'],
            ['Pesto Sauce', 70, 'ml', 'Sauce'],
            ['Lemon Concentrate', 120, 'ml', 'Syrup'],
            ['Cucumber', 120, 'g', 'Vegetable'],
            ['Ice', 250, 'g', 'Utility'],
        ],
    },
    'Family Set A': {
        description: 'Good for 4-6 pax. Includes 1 Spinach Pizza, 1 Beef & Mushroom Pizza, 1 Garlic Parmesan Chicken Solo, 1 Honey Glazed Chicken Solo, 1 Tuna Pesto, 1 Carbonara, and 1L Lemon Iced Tea.',
        recipe: [
            ['Pizza Dough', 2, 'pcs', 'Bread'],
            ['Pizza Sauce', 130, 'ml', 'Sauce'],
            ['Mozzarella Cheese', 210, 'g', 'Dairy'],
            ['Spinach', 80, 'g', 'Vegetable'],
            ['Beef', 90, 'g', 'Meat'],
            ['Mushroom', 80, 'g', 'Vegetable'],
            ['Chicken', 440, 'g', 'Meat'],
            ['Garlic Parmesan Mix', 25, 'g', 'Spice'],
            ['Honey Glaze', 45, 'ml', 'Sauce'],
            ['Cooking Oil', 70, 'ml', 'Oil'],
            ['Pasta Noodles', 360, 'g', 'Grain'],
            ['Tuna', 80, 'g', 'Meat'],
            ['Pesto Sauce', 70, 'ml', 'Sauce'],
            ['Cream Sauce', 100, 'ml', 'Sauce'],
            ['Bacon Bits', 40, 'g', 'Meat'],
            ['Tea Base', 700, 'ml', 'Tea'],
            ['Lemon Concentrate', 120, 'ml', 'Syrup'],
            ['Ice', 250, 'g', 'Utility'],
        ],
    },
    'Family Set B': {
        description: 'Good for 4-6 pax. Includes 1 Hawaiian Pizza, 1 Pepperoni Pizza, 1 Garlic Parmesan Chicken Solo, 1 Honey Glazed Chicken Solo, 1 Baked Penne, 1 Carbonara, and 1L Cucumber Lemonade.',
        recipe: [
            ['Pizza Dough', 2, 'pcs', 'Bread'],
            ['Pizza Sauce', 120, 'ml', 'Sauce'],
            ['Mozzarella Cheese', 180, 'g', 'Dairy'],
            ['Ham', 45, 'g', 'Meat'],
            ['Pineapple', 45, 'g', 'Fruit'],
            ['Pepperoni', 60, 'g', 'Meat'],
            ['Chicken', 440, 'g', 'Meat'],
            ['Garlic Parmesan Mix', 25, 'g', 'Spice'],
            ['Honey Glaze', 45, 'ml', 'Sauce'],
            ['Cooking Oil', 70, 'ml', 'Oil'],
            ['Pasta Noodles', 360, 'g', 'Grain'],
            ['Tomato Sauce', 90, 'ml', 'Sauce'],
            ['Cream Sauce', 100, 'ml', 'Sauce'],
            ['Bacon Bits', 40, 'g', 'Meat'],
            ['Lemon Concentrate', 120, 'ml', 'Syrup'],
            ['Cucumber', 120, 'g', 'Vegetable'],
            ['Ice', 250, 'g', 'Utility'],
        ],
    },
};

async function findOrCreateIngredient([name, amountPerServing, unit, category]) {
    const item = await Inventory.findOneAndUpdate(
        { name },
        {
            $setOnInsert: {
                name,
                unit,
                stock: unit === 'pcs' ? 100 : 5000,
                lowStockAt: unit === 'pcs' ? 20 : 800,
                category,
            },
        },
        { returnDocument: 'after', upsert: true }
    );

    return {
        inventoryId: item._id,
        name: item.name,
        amountPerServing,
        unit: item.unit,
        platterMultiplier: 1,
    };
}

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    for (const [name, set] of Object.entries(setProducts)) {
        const product = await Product.findOneAndUpdate(
            { name },
            { description: set.description },
            { returnDocument: 'after' }
        );

        if (!product) {
            console.log(`Skipped missing product: ${name}`);
            continue;
        }

        const ingredients = [];
        for (const recipeItem of set.recipe) {
            ingredients.push(await findOrCreateIngredient(recipeItem));
        }

        await Recipe.findOneAndUpdate(
            { productId: product._id },
            {
                productId: product._id,
                productName: product.name,
                ingredients,
            },
            { returnDocument: 'after', upsert: true }
        );

        console.log(`Updated ${name}: ${ingredients.length} ingredients`);
    }

    await mongoose.disconnect();
}

run()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Update failed:', err.message);
        process.exit(1);
    });
