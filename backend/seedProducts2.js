//to change the database products
//cd backend
//node seedProducts2.js
require('dotenv').config();
const mongoose = require('mongoose');

// Schemas
const CategorySchema = new mongoose.Schema({
  name: String
});

const ProductSchema = new mongoose.Schema({
  name: String,
  price: Number,
  categoryId: mongoose.Schema.Types.ObjectId,
  status: String
});

const InventorySchema = new mongoose.Schema({
  productId: mongoose.Schema.Types.ObjectId,
  stock: Number,
  sold: Number
});

const SalesSchema = new mongoose.Schema({
  products: [
    {
      productId: mongoose.Schema.Types.ObjectId,
      name: String,
      quantity: Number,
      price: Number
    }
  ],
  totalAmount: Number,
  date: Date
});

// Models

const Category = mongoose.model('Category', CategorySchema);
const Product = mongoose.model('Product', ProductSchema);
const Inventory = mongoose.model('Inventory', InventorySchema);
const Sales = mongoose.model('Sales', SalesSchema);

module.exports = { Category, Product, Inventory, Sales };
// Seed Function
async function seedDatabase() {
  try {
    // ✅ CONNECT FIRST
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to DB");

    // ✅ THEN DROP DATABASE
    // await mongoose.connection.dropDatabase();
    // console.log("🗑️ Database cleared");

    await Category.deleteMany({});
    await Product.deleteMany({});
    await Inventory.deleteMany({});
    await Sales.deleteMany({});

    // 1. Categories
    const mainDish = await Category.create({ name: 'Main Dish' });
    const pasta = await Category.create({ name: 'Pasta' });
    const drinks = await Category.create({ name: 'Drinks' });
    const salusalo = await Category.create({ name: 'Salusalo' });
    const appetizer = await Category.create({ name: 'Appetizer' });
    const waffles = await Category.create({ name: 'Waffles' });
    const tiramisu = await Category.create({ name: 'Tiramisu' });

    // 2. Products per category
    const products = await Product.insertMany([
      { name: 'Fried Chicken', price: 150, categoryId: mainDish._id, status: 'available' },
      { name: 'Steak', price: 300, categoryId: mainDish._id, status: 'available' },

      { name: 'Carbonara', price: 120, categoryId: pasta._id, status: 'available' },
      { name: 'Aglio Olio', price: 110, categoryId: pasta._id, status: 'available' },

      { name: 'Spanish Latte', price: 100, categoryId: drinks._id, status: 'available' },
      { name: 'Mango Shake', price: 90, categoryId: drinks._id, status: 'available' }
    ]);

    // 3. Inventory
    const inventoryData = products.map(p => ({
      productId: p._id,
      stock: 50,
      sold: Math.floor(Math.random() * 20)
    }));

    await Inventory.insertMany(inventoryData);

    // 4. Sales
    await Sales.insertMany([
      {
        products: [
          {
            productId: products[0]._id,
            name: products[0].name,
            quantity: 2,
            price: products[0].price
          }
        ],
        totalAmount: 300,
        date: new Date()
      },
      {
        products: [
          {
            productId: products[2]._id,
            name: products[2].name,
            quantity: 1,
            price: products[2].price
          },
          {
            productId: products[4]._id,
            name: products[4].name,
            quantity: 1,
            price: products[4].price
          }
        ],
        totalAmount: 220,
        date: new Date()
      }
    ]);

    console.log('✅ Database seeded successfully!');
    process.exit();
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// ✅ CALL FUNCTION
seedDatabase();