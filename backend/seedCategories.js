// Seed Categories
require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./models/Category');

const categories = [
  { name: 'Main Dish' },
  { name: 'Pastas' },
  { name: 'Salu-Salo Set' },
  { name: 'Pizzas' },
  { name: 'Appetizer' },
  { name: 'Waffles' },
  { name: 'Tiramisu' },
  { name: 'Drinks' }
];

async function seedCategories() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to DB');

    await Category.deleteMany({});
    console.log('🗑️  Cleared existing categories');

    const inserted = await Category.insertMany(categories);
    console.log(`✅ Successfully added ${inserted.length} categories!\n`);

    categories.forEach((cat, i) => {
      console.log(`   ${i + 1}. ${cat.name}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seedCategories();
