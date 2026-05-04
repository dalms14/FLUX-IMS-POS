require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

const mainDishProducts = [
    {
        name: 'Chicken Alaking',
        category: 'MAIN DISH',
        description: "Crispy fried chicken smothered in Eli Coffee's signature creamy sauce with tender carrots — rich, comforting, and an absolute must-try!",
        soloPrice: 325,
        platterPrice: 949,
        variants: [],
        available: true,
    },
    {
        name: 'Flavored Chicken',
        category: 'MAIN DISH',
        description: 'Choose your favorite flavor of crispy fried chicken.',
        soloPrice: 250,
        platterPrice: 665,
        variants: ['Garlic Parmesan', 'Garlic Mayo', 'Cheesy Cheese', 'Honey Glaze'],
        available: true,
    },
    {
        name: 'Sweet & Sour Fish Fillet',
        category: 'MAIN DISH',
        description: 'Crispy golden fish fillets tossed in a vibrant sweet and tangy sauce with bell peppers, onions, and pineapples.',
        soloPrice: 195,
        platterPrice: 485,
        variants: [],
        available: true,
    },
    {
        name: 'Garlic Mayo Fish Fillet',
        category: 'MAIN DISH',
        description: 'Lightly breaded fish fillets fried to golden perfection, topped with a rich, creamy garlic mayo sauce.',
        soloPrice: 190,
        platterPrice: 475,
        variants: [],
        available: true,
    },
    {
        name: 'Hungarian Sausage',
        category: 'MAIN DISH',
        description: 'Grilled Hungarian sausage with tomato-cucumber sides and garlic mayo dip.',
        soloPrice: 195,
        platterPrice: null, // no platter available
        variants: [],
        available: true,
    },
];

async function seed() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to DB');

    // Remove existing Main Dish products first
    await mongoose.connection.db.collection('products').deleteMany({ category: 'MAIN DISH' });
    console.log('🗑️  Cleared existing Main Dish products');

    // Insert fresh products
    await mongoose.connection.db.collection('products').insertMany(mainDishProducts);
    console.log('✅ Main Dish products seeded!');

    mainDishProducts.forEach(p => {
        console.log(`   → ${p.name} | Solo: ₱${p.soloPrice} | Platter: ${p.platterPrice ? '₱' + p.platterPrice : 'N/A'} | Variants: ${p.variants.length > 0 ? p.variants.join(', ') : 'None'}`);
    });

    process.exit();
}

seed().catch(err => {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
});