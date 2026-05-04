require('dotenv').config();
const mongoose = require('mongoose');
const Inventory = require('./models/Inventory');
const Recipe = require('./models/Recipe');
const Product = require('./models/Product');

// Defense/demo data only. Replace these with owner-verified measurements later.
const demoIngredients = [
    { name: 'Chicken', unit: 'g', stock: 12000, lowStockAt: 2500, category: 'Meat' },
    { name: 'Fish Fillet', unit: 'g', stock: 9000, lowStockAt: 1800, category: 'Meat' },
    { name: 'Hungarian Sausage', unit: 'pcs', stock: 250, lowStockAt: 40, category: 'Meat' },
    { name: 'Tuna', unit: 'g', stock: 3500, lowStockAt: 700, category: 'Meat' },
    { name: 'Bacon Bits', unit: 'g', stock: 2500, lowStockAt: 500, category: 'Meat' },
    { name: 'Pepperoni', unit: 'g', stock: 2500, lowStockAt: 500, category: 'Meat' },
    { name: 'Ham', unit: 'g', stock: 2500, lowStockAt: 500, category: 'Meat' },
    { name: 'Beef', unit: 'g', stock: 3500, lowStockAt: 700, category: 'Meat' },

    { name: 'Plain Rice', unit: 'g', stock: 25000, lowStockAt: 4000, category: 'Grain' },
    { name: 'Pasta Noodles', unit: 'g', stock: 10000, lowStockAt: 1800, category: 'Grain' },
    { name: 'Pizza Dough', unit: 'pcs', stock: 180, lowStockAt: 30, category: 'Bread' },
    { name: 'Nacho Chips', unit: 'g', stock: 6000, lowStockAt: 1000, category: 'Snack' },
    { name: 'Potato Fries', unit: 'g', stock: 10000, lowStockAt: 1800, category: 'Snack' },
    { name: 'Squid Rings', unit: 'g', stock: 5000, lowStockAt: 900, category: 'Seafood' },

    { name: 'Creamy Sauce', unit: 'ml', stock: 9000, lowStockAt: 1600, category: 'Sauce' },
    { name: 'Garlic Mayo', unit: 'ml', stock: 6000, lowStockAt: 1000, category: 'Sauce' },
    { name: 'Garlic Parmesan Mix', unit: 'g', stock: 3500, lowStockAt: 650, category: 'Spice' },
    { name: 'Honey Glaze', unit: 'ml', stock: 4500, lowStockAt: 800, category: 'Sauce' },
    { name: 'Sweet & Sour Sauce', unit: 'ml', stock: 6000, lowStockAt: 1000, category: 'Sauce' },
    { name: 'Tomato Sauce', unit: 'ml', stock: 7000, lowStockAt: 1300, category: 'Sauce' },
    { name: 'Cream Sauce', unit: 'ml', stock: 7000, lowStockAt: 1300, category: 'Sauce' },
    { name: 'Pesto Sauce', unit: 'ml', stock: 4500, lowStockAt: 800, category: 'Sauce' },
    { name: 'Pizza Sauce', unit: 'ml', stock: 4500, lowStockAt: 800, category: 'Sauce' },
    { name: 'Cheese Sauce', unit: 'ml', stock: 4500, lowStockAt: 800, category: 'Sauce' },
    { name: 'Caramel Syrup', unit: 'ml', stock: 5000, lowStockAt: 900, category: 'Syrup' },
    { name: 'Hazelnut Syrup', unit: 'ml', stock: 4500, lowStockAt: 800, category: 'Syrup' },
    { name: 'Strawberry Syrup', unit: 'ml', stock: 4500, lowStockAt: 800, category: 'Syrup' },
    { name: 'Blueberry Syrup', unit: 'ml', stock: 4500, lowStockAt: 800, category: 'Syrup' },
    { name: 'Vanilla Syrup', unit: 'ml', stock: 4500, lowStockAt: 800, category: 'Syrup' },
    { name: 'Lychee Syrup', unit: 'ml', stock: 4500, lowStockAt: 800, category: 'Syrup' },
    { name: 'Green Apple Syrup', unit: 'ml', stock: 4500, lowStockAt: 800, category: 'Syrup' },
    { name: 'Lemon Concentrate', unit: 'ml', stock: 4500, lowStockAt: 800, category: 'Syrup' },

    { name: 'Cooking Oil', unit: 'ml', stock: 12000, lowStockAt: 2500, category: 'Oil' },
    { name: 'Bell Pepper', unit: 'g', stock: 3500, lowStockAt: 600, category: 'Vegetable' },
    { name: 'Pineapple', unit: 'g', stock: 3000, lowStockAt: 500, category: 'Fruit' },
    { name: 'Tomato', unit: 'g', stock: 3500, lowStockAt: 600, category: 'Vegetable' },
    { name: 'Cucumber', unit: 'g', stock: 3500, lowStockAt: 600, category: 'Vegetable' },
    { name: 'Spinach', unit: 'g', stock: 2500, lowStockAt: 450, category: 'Vegetable' },
    { name: 'Mushroom', unit: 'g', stock: 2500, lowStockAt: 450, category: 'Vegetable' },
    { name: 'Avocado Puree', unit: 'g', stock: 3500, lowStockAt: 600, category: 'Fruit' },

    { name: 'Coffee Beans', unit: 'g', stock: 8000, lowStockAt: 1400, category: 'Coffee' },
    { name: 'Cold Brew Concentrate', unit: 'ml', stock: 7000, lowStockAt: 1200, category: 'Coffee' },
    { name: 'Fresh Milk', unit: 'ml', stock: 18000, lowStockAt: 3500, category: 'Dairy' },
    { name: 'Condensed Milk', unit: 'ml', stock: 6500, lowStockAt: 1200, category: 'Dairy' },
    { name: 'Whipped Cream', unit: 'g', stock: 3500, lowStockAt: 600, category: 'Dairy' },
    { name: 'Cream Cheese', unit: 'g', stock: 3500, lowStockAt: 600, category: 'Dairy' },
    { name: 'Mozzarella Cheese', unit: 'g', stock: 6000, lowStockAt: 1000, category: 'Dairy' },

    { name: 'Chocolate Powder', unit: 'g', stock: 5000, lowStockAt: 900, category: 'Powder' },
    { name: 'Dark Chocolate Sauce', unit: 'ml', stock: 4500, lowStockAt: 800, category: 'Sauce' },
    { name: 'Matcha Powder', unit: 'g', stock: 3000, lowStockAt: 500, category: 'Powder' },
    { name: 'Cookie Crumbs', unit: 'g', stock: 3500, lowStockAt: 600, category: 'Topping' },
    { name: 'Oreo Crumbs', unit: 'g', stock: 3500, lowStockAt: 600, category: 'Topping' },
    { name: 'Biscoff Spread', unit: 'g', stock: 3500, lowStockAt: 600, category: 'Topping' },
    { name: 'Almonds', unit: 'g', stock: 2500, lowStockAt: 450, category: 'Topping' },

    { name: 'Waffle Batter', unit: 'ml', stock: 8000, lowStockAt: 1400, category: 'Batter' },
    { name: 'Ladyfingers', unit: 'pcs', stock: 450, lowStockAt: 80, category: 'Pastry' },
    { name: 'Mascarpone Cream', unit: 'g', stock: 5000, lowStockAt: 900, category: 'Dairy' },
    { name: 'Cocoa Powder', unit: 'g', stock: 2500, lowStockAt: 450, category: 'Powder' },
    { name: 'Cheesecake Cream', unit: 'g', stock: 3500, lowStockAt: 600, category: 'Dairy' },
    { name: 'Tea Base', unit: 'ml', stock: 10000, lowStockAt: 1800, category: 'Tea' },
    { name: 'Ice', unit: 'g', stock: 30000, lowStockAt: 5000, category: 'Utility' },
];

const productRecipes = {
    'Chicken Alaking': [
        ['Chicken', 250],
        ['Creamy Sauce', 80],
        ['Cooking Oil', 30],
        ['Plain Rice', 200],
    ],
    'Flavored Chicken': [
        ['Chicken', 220],
        ['Garlic Mayo', 30],
        ['Cooking Oil', 35],
        ['Plain Rice', 200],
    ],
    'Sweet & Sour Fish Fillet': [
        ['Fish Fillet', 200],
        ['Sweet & Sour Sauce', 100],
        ['Bell Pepper', 40],
        ['Pineapple', 40],
        ['Cooking Oil', 30],
        ['Plain Rice', 200],
    ],
    'Garlic Mayo Fish Fillet': [
        ['Fish Fillet', 200],
        ['Garlic Mayo', 60],
        ['Cooking Oil', 30],
        ['Plain Rice', 200],
    ],
    'Hungarian Sausage': [
        ['Hungarian Sausage', 2],
        ['Tomato', 50],
        ['Cucumber', 50],
        ['Garlic Mayo', 30],
    ],
    'Tuna Pesto': [
        ['Pasta Noodles', 180],
        ['Tuna', 80],
        ['Pesto Sauce', 70],
        ['Mozzarella Cheese', 25],
    ],
    'Baked Penne': [
        ['Pasta Noodles', 180],
        ['Tomato Sauce', 90],
        ['Mozzarella Cheese', 60],
    ],
    'Creamy Carbonara': [
        ['Pasta Noodles', 180],
        ['Cream Sauce', 100],
        ['Bacon Bits', 40],
        ['Mozzarella Cheese', 25],
    ],
    'Hawaiian Pizza': [
        ['Pizza Dough', 1],
        ['Pizza Sauce', 60],
        ['Mozzarella Cheese', 90],
        ['Ham', 45],
        ['Pineapple', 45],
    ],
    'Pepperoni Pizza': [
        ['Pizza Dough', 1],
        ['Pizza Sauce', 60],
        ['Mozzarella Cheese', 90],
        ['Pepperoni', 60],
    ],
    'Specialty Pizza': [
        ['Pizza Dough', 1],
        ['Pizza Sauce', 70],
        ['Mozzarella Cheese', 100],
        ['Pepperoni', 40],
        ['Ham', 40],
        ['Bell Pepper', 30],
    ],
    'French Fries': [
        ['Potato Fries', 180],
        ['Cooking Oil', 30],
    ],
    'Overload Fries': [
        ['Potato Fries', 220],
        ['Cheese Sauce', 70],
        ['Bacon Bits', 35],
    ],
    'Nachos Overload': [
        ['Nacho Chips', 160],
        ['Cheese Sauce', 80],
        ['Tomato', 40],
    ],
    'Kalamari': [
        ['Squid Rings', 180],
        ['Cooking Oil', 35],
        ['Garlic Mayo', 35],
    ],
};

const drinkRecipes = {
    'Spanish Latte': [['Coffee Beans', 18], ['Fresh Milk', 180], ['Condensed Milk', 35], ['Ice', 120]],
    'Caramel Cold Brew': [['Cold Brew Concentrate', 120], ['Fresh Milk', 120], ['Caramel Syrup', 30], ['Ice', 140]],
    'Hazelnut Latte': [['Coffee Beans', 18], ['Fresh Milk', 190], ['Hazelnut Syrup', 25], ['Ice', 120]],
    'Dark Mocha': [['Coffee Beans', 18], ['Fresh Milk', 170], ['Dark Chocolate Sauce', 35], ['Ice', 120]],
    'Biscoff Latte': [['Coffee Beans', 18], ['Fresh Milk', 180], ['Biscoff Spread', 35], ['Ice', 120]],
    'Chocoloco': [['Chocolate Powder', 45], ['Fresh Milk', 180], ['Whipped Cream', 25], ['Ice', 160]],
    'Cookies & Cream': [['Cookie Crumbs', 50], ['Fresh Milk', 180], ['Whipped Cream', 25], ['Ice', 160]],
    'Avocado': [['Avocado Puree', 90], ['Fresh Milk', 160], ['Condensed Milk', 25], ['Ice', 160]],
    'Strawberry Vanilla': [['Strawberry Syrup', 40], ['Vanilla Syrup', 20], ['Fresh Milk', 180], ['Ice', 160]],
    'Blueberry Cheesecake': [['Blueberry Syrup', 40], ['Cheesecake Cream', 45], ['Fresh Milk', 170], ['Ice', 160]],
    'Matcha Frappe': [['Matcha Powder', 18], ['Fresh Milk', 180], ['Whipped Cream', 25], ['Ice', 170]],
    'Matcha Latte': [['Matcha Powder', 15], ['Fresh Milk', 200], ['Ice', 120]],
    'Lychee': [['Tea Base', 180], ['Lychee Syrup', 35], ['Ice', 140]],
    'Green Apple': [['Tea Base', 180], ['Green Apple Syrup', 35], ['Ice', 140]],
    'Lemon Iced Tea': [['Tea Base', 180], ['Lemon Concentrate', 35], ['Ice', 140]],
    'Cucumber Lemonade': [['Lemon Concentrate', 35], ['Cucumber', 45], ['Ice', 140]],
    'Hot Cold Brew Coffee': [['Cold Brew Concentrate', 140], ['Fresh Milk', 60]],
};

const dessertRecipes = {
    'Plain Waffle': [['Waffle Batter', 150], ['Whipped Cream', 20]],
    'Caramel Waffle': [['Waffle Batter', 150], ['Caramel Syrup', 35], ['Whipped Cream', 20]],
    'Blueberry Waffle': [['Waffle Batter', 150], ['Blueberry Syrup', 35], ['Whipped Cream', 20]],
    'Almond Choco Waffle': [['Waffle Batter', 150], ['Dark Chocolate Sauce', 35], ['Almonds', 25]],
    'Biscoff Waffle': [['Waffle Batter', 150], ['Biscoff Spread', 35], ['Whipped Cream', 20]],
    'Classic Misu': [['Ladyfingers', 4], ['Mascarpone Cream', 90], ['Coffee Beans', 8], ['Cocoa Powder', 8]],
    'Oreo Misu': [['Ladyfingers', 4], ['Mascarpone Cream', 80], ['Oreo Crumbs', 35]],
    'BrewMisu': [['Ladyfingers', 4], ['Mascarpone Cream', 85], ['Coffee Beans', 14], ['Cocoa Powder', 8]],
    'Matcha Misu': [['Ladyfingers', 4], ['Mascarpone Cream', 85], ['Matcha Powder', 12]],
    'Biscoff Misu': [['Ladyfingers', 4], ['Mascarpone Cream', 80], ['Biscoff Spread', 35]],
};

const setRecipes = {
    'Couple Set A': [
        ['Pizza Dough', 1],
        ['Pizza Sauce', 60],
        ['Mozzarella Cheese', 90],
        ['Ham', 45],
        ['Pineapple', 45],
        ['Chicken', 220],
        ['Honey Glaze', 45],
        ['Cooking Oil', 35],
        ['Pasta Noodles', 180],
        ['Cream Sauce', 100],
        ['Bacon Bits', 40],
        ['Tea Base', 700],
        ['Lemon Concentrate', 120],
        ['Ice', 250],
    ],
    'Couple Set B': [
        ['Pizza Dough', 1],
        ['Pizza Sauce', 60],
        ['Mozzarella Cheese', 90],
        ['Pepperoni', 60],
        ['Chicken', 220],
        ['Garlic Parmesan Mix', 25],
        ['Cooking Oil', 35],
        ['Pasta Noodles', 180],
        ['Tuna', 80],
        ['Pesto Sauce', 70],
        ['Lemon Concentrate', 120],
        ['Cucumber', 120],
        ['Ice', 250],
    ],
    'Family Set A': [
        ['Pizza Dough', 2],
        ['Pizza Sauce', 130],
        ['Mozzarella Cheese', 210],
        ['Spinach', 80],
        ['Beef', 90],
        ['Mushroom', 80],
        ['Chicken', 440],
        ['Garlic Parmesan Mix', 25],
        ['Honey Glaze', 45],
        ['Cooking Oil', 70],
        ['Pasta Noodles', 360],
        ['Tuna', 80],
        ['Pesto Sauce', 70],
        ['Cream Sauce', 100],
        ['Bacon Bits', 40],
        ['Tea Base', 700],
        ['Lemon Concentrate', 120],
        ['Ice', 250],
    ],
    'Family Set B': [
        ['Pizza Dough', 2],
        ['Pizza Sauce', 120],
        ['Mozzarella Cheese', 180],
        ['Ham', 45],
        ['Pineapple', 45],
        ['Pepperoni', 60],
        ['Chicken', 440],
        ['Garlic Parmesan Mix', 25],
        ['Honey Glaze', 45],
        ['Cooking Oil', 70],
        ['Pasta Noodles', 360],
        ['Tomato Sauce', 90],
        ['Cream Sauce', 100],
        ['Bacon Bits', 40],
        ['Lemon Concentrate', 120],
        ['Cucumber', 120],
        ['Ice', 250],
    ],
};

function buildIngredientRows(recipe, ingredientMap) {
    return recipe.map(([name, amountPerServing]) => {
        const ingredient = ingredientMap[name];
        if (!ingredient) {
            throw new Error(`Missing demo ingredient: ${name}`);
        }

        return {
            inventoryId: ingredient._id,
            name,
            amountPerServing,
            unit: ingredient.unit,
            platterMultiplier: 3,
        };
    });
}

function recipeForProduct(product) {
    return (
        productRecipes[product.name] ||
        drinkRecipes[product.name] ||
        dessertRecipes[product.name] ||
        setRecipes[product.name] ||
        null
    );
}

async function seed() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    await mongoose.connection.db.collection('inventory').deleteMany({});
    await mongoose.connection.db.collection('recipes').deleteMany({});
    console.log('Cleared inventory and recipes');

    const inserted = await Inventory.insertMany(demoIngredients);
    console.log(`Inserted ${inserted.length} demo ingredients`);

    const ingredientMap = {};
    inserted.forEach(ingredient => {
        ingredientMap[ingredient.name] = ingredient;
    });

    const products = await Product.find({});
    console.log(`Found ${products.length} products`);

    let recipeCount = 0;
    const missingRecipes = [];

    for (const product of products) {
        const recipe = recipeForProduct(product);
        if (!recipe) {
            missingRecipes.push(product.name);
            continue;
        }

        await Recipe.create({
            productId: product._id,
            productName: product.name,
            ingredients: buildIngredientRows(recipe, ingredientMap),
        });

        console.log(`Recipe created: ${product.name}`);
        recipeCount += 1;
    }

    console.log(`Seeded ${recipeCount} demo recipes`);

    if (missingRecipes.length > 0) {
        console.log(`Products without demo recipes: ${missingRecipes.join(', ')}`);
    }

    await mongoose.disconnect();
}

seed()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Seed failed:', err.message);
        process.exit(1);
    });
