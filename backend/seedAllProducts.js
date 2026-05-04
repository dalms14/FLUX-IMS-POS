// Comprehensive Product Seed File
// Usage: cd backend && node seedAllProducts.js

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');
const Category = require('./models/Category');

const allProducts = [
  // ========== MAIN DISH ==========
  {
    name: 'Chicken Alaking',
    category: 'Main Dish',
    description: "Crispy fried chicken smothered in Eli Coffee's signature creamy sauce with tender carrots — rich, comforting, and an absolute must-try!",
    soloPrice: 325,
    platterPrice: 949,
    variants: [],
    available: true,
  },
  {
    name: 'Flavored Chicken',
    category: 'Main Dish',
    description: 'Choose your favorite flavor of crispy fried chicken.',
    soloPrice: 250,
    platterPrice: 665,
    variants: ['Garlic Parmesan', 'Garlic Mayo', 'Cheesy Cheese', 'Honey Glaze'],
    available: true,
  },
  {
    name: 'Sweet & Sour Fish Fillet',
    category: 'Main Dish',
    description: 'Crispy golden fish fillets tossed in a vibrant sweet and tangy sauce with bell peppers, onions, and pineapples.',
    soloPrice: 195,
    platterPrice: 485,
    variants: [],
    available: true,
  },
  {
    name: 'Garlic Mayo Fish Fillet',
    category: 'Main Dish',
    description: 'Lightly breaded fish fillets fried to golden perfection, topped with a rich, creamy garlic mayo sauce.',
    soloPrice: 190,
    platterPrice: 475,
    variants: [],
    available: true,
  },
  {
    name: 'Hungarian Sausage',
    category: 'Main Dish',
    description: 'Grilled Hungarian sausage with tomato-cucumber sides and garlic mayo dip.',
    soloPrice: 195,
    platterPrice: null,
    variants: [],
    available: true,
  },

  // ========== PASTAS ==========
  {
    name: 'Tuna Pesto',
    category: 'Pastas',
    description: 'Smooth tuna-based pesto pasta with al dente noodles.',
    soloPrice: 310,
    platterPrice: 620,
    variants: [],
    available: true,
  },
  {
    name: 'Baked Penne',
    category: 'Pastas',
    description: 'Oven-baked penne pasta with rich tomato sauce and melted cheese.',
    soloPrice: 260,
    platterPrice: 520,
    variants: [],
    available: true,
  },
  {
    name: 'Creamy Carbonara',
    category: 'Pastas',
    description: 'Classic Italian pasta with creamy bacon and egg sauce.',
    soloPrice: 295,
    platterPrice: 590,
    variants: [],
    available: true,
  },

  // ========== SALU-SALO SET ==========
  {
    name: 'Couple Set A',
    category: 'Salu-Salo Set',
    description: 'Includes 1 Hawaiian Pizza, 1 Honey Glazed Chicken, 1 Carbonara, and 1L Lemon Iced Tea.',
    price: 965,
    variants: [],
    available: true,
  },
  {
    name: 'Couple Set B',
    category: 'Salu-Salo Set',
    description: 'Includes 1 Pepperoni Pizza, 1 Garlic Parmesan Chicken, 1 Tuna Pesto, and 1L Cucumber Lemonade.',
    price: 1040,
    variants: [],
    available: true,
  },
  {
    name: 'Family Set A',
    category: 'Salu-Salo Set',
    description: 'Good for 4-6 pax. Includes 1 Spinach Pizza, 1 Beef & Mushroom Pizza, 1 Garlic Parmesan Chicken Solo, 1 Honey Glazed Chicken Solo, 1 Tuna Pesto, 1 Carbonara, and 1L Lemon Iced Tea.',
    price: 1750,
    variants: [],
    available: true,
  },
  {
    name: 'Family Set B',
    category: 'Salu-Salo Set',
    description: 'Good for 4-6 pax. Includes 1 Hawaiian Pizza, 1 Pepperoni Pizza, 1 Garlic Parmesan Chicken Solo, 1 Honey Glazed Chicken Solo, 1 Baked Penne, 1 Carbonara, and 1L Cucumber Lemonade.',
    price: 1740,
    variants: [],
    available: true,
  },

  // ========== PIZZAS ==========
  {
    name: 'Hawaiian Pizza',
    category: 'Pizzas',
    description: 'Classic Hawaiian pizza with pineapple and ham.',
    price: 205,
    variants: [],
    available: true,
  },
  {
    name: 'Pepperoni Pizza',
    category: 'Pizzas',
    description: 'Traditional pepperoni pizza with mozzarella cheese.',
    price: 215,
    variants: [],
    available: true,
  },
  {
    name: 'Specialty Pizza',
    category: 'Pizzas',
    description: 'Chef\'s special pizza with premium toppings.',
    price: 245,
    variants: [],
    available: true,
  },

  // ========== APPETIZER ==========
  {
    name: 'French Fries',
    category: 'Appetizer',
    description: 'Crispy golden french fries with salt.',
    price: 165,
    variants: [],
    available: true,
  },
  {
    name: 'Overload Fries',
    category: 'Appetizer',
    description: 'Loaded fries with cheese, bacon, and sour cream.',
    price: 315,
    variants: [],
    available: true,
  },
  {
    name: 'Nachos Overload',
    category: 'Appetizer',
    description: 'Crispy nachos topped with cheese, jalapeños, and sour cream.',
    price: 285,
    variants: [],
    available: true,
  },
  {
    name: 'Kalamari',
    category: 'Appetizer',
    description: 'Tender fried squid rings with marinara sauce.',
    price: 185,
    variants: [],
    available: true,
  },

  // ========== WAFFLES ==========
  {
    name: 'Plain Waffle',
    category: 'Waffles',
    description: 'Classic plain waffle served warm and crispy.',
    price: 125,
    variants: [],
    available: true,
  },
  {
    name: 'Caramel Waffle',
    category: 'Waffles',
    description: 'Delicious waffle drizzled with sweet caramel sauce.',
    price: 175,
    variants: [],
    available: true,
  },
  {
    name: 'Blueberry Waffle',
    category: 'Waffles',
    description: 'Fresh blueberry waffle with whipped cream.',
    price: 205,
    variants: [],
    available: true,
  },
  {
    name: 'Almond Choco Waffle',
    category: 'Waffles',
    description: 'Waffle with chocolate and almond toppings.',
    price: 225,
    variants: [],
    available: true,
  },
  {
    name: 'Biscoff Waffle',
    category: 'Waffles',
    description: 'Waffle with Biscoff spread and cookies.',
    price: 255,
    variants: [],
    available: true,
  },

  // ========== TIRAMISU ==========
  {
    name: 'Classic Misu',
    category: 'Tiramisu',
    description: 'Traditional tiramisu with mascarpone and cocoa.',
    price: 265,
    variants: [],
    available: true,
  },
  {
    name: 'Oreo Misu',
    category: 'Tiramisu',
    description: 'Creamy tiramisu with crushed Oreo cookies.',
    price: 265,
    variants: [],
    available: true,
  },
  {
    name: 'BrewMisu',
    category: 'Tiramisu',
    description: 'Rich tiramisu with extra coffee flavor.',
    price: 295,
    variants: [],
    available: true,
  },
  {
    name: 'Matcha Misu',
    category: 'Tiramisu',
    description: 'Unique green matcha flavored tiramisu.',
    price: 289,
    variants: [],
    available: true,
  },
  {
    name: 'Biscoff Misu',
    category: 'Tiramisu',
    description: 'Tiramisu with Biscoff spread layers.',
    price: 289,
    variants: [],
    available: true,
  },

  // ========== DRINKS ==========
  // Coffee (Top Row)
  {
    name: 'Spanish Latte',
    category: 'Drinks',
    description: 'Classic Spanish latte with sweet condensed milk.',
    price: 155,
    variants: [],
    available: true,
  },
  {
    name: 'Caramel Cold Brew',
    category: 'Drinks',
    description: 'Smooth cold brew coffee with rich caramel flavor.',
    price: 175,
    variants: [],
    available: true,
  },
  {
    name: 'Hazelnut Latte',
    category: 'Drinks',
    description: 'Creamy latte infused with hazelnut flavor.',
    price: 165,
    variants: [],
    available: true,
  },
  {
    name: 'Dark Mocha',
    category: 'Drinks',
    description: 'Rich blend of espresso and dark chocolate.',
    price: 175,
    variants: [],
    available: true,
  },
  {
    name: 'Biscoff Latte',
    category: 'Drinks',
    description: 'Creamy latte with Biscoff spread layers.',
    price: 185,
    variants: [],
    available: true,
  },
  // Beyond Coffee - Blended
  {
    name: 'Chocoloco',
    category: 'Drinks',
    description: 'Delicious chocolate and coconut blended drink.',
    price: 175,
    variants: [],
    available: true,
  },
  {
    name: 'Cookies & Cream',
    category: 'Drinks',
    description: 'Creamy blended drink with cookie pieces.',
    price: 185,
    variants: [],
    available: true,
  },
  {
    name: 'Avocado',
    category: 'Drinks',
    description: 'Smooth and creamy avocado blended drink.',
    price: 195,
    variants: [],
    available: true,
  },
  {
    name: 'Strawberry Vanilla',
    category: 'Drinks',
    description: 'Sweet strawberry and vanilla blended beverage.',
    price: 175,
    variants: [],
    available: true,
  },
  {
    name: 'Blueberry Cheesecake',
    category: 'Drinks',
    description: 'Indulgent blueberry cheesecake blended drink.',
    price: 185,
    variants: [],
    available: true,
  },
  // Matcha
  {
    name: 'Matcha Frappe',
    category: 'Drinks',
    description: 'Refreshing matcha green tea frappe with ice.',
    price: 165,
    variants: [],
    available: true,
  },
  {
    name: 'Matcha Latte',
    category: 'Drinks',
    description: 'Creamy matcha green tea latte.',
    price: 155,
    variants: [],
    available: true,
  },
  // Fruit Tea
  {
    name: 'Lychee',
    category: 'Drinks',
    description: 'Refreshing lychee fruit tea.',
    price: 135,
    variants: [],
    available: true,
  },
  {
    name: 'Green Apple',
    category: 'Drinks',
    description: 'Crisp and refreshing green apple fruit tea.',
    price: 135,
    variants: [],
    available: true,
  },
  // Juices
  {
    name: 'Lemon Iced Tea',
    category: 'Drinks',
    description: 'Refreshing lemon iced tea (Regular and 1L available).',
    price: 125,
    variants: ['Regular', '1L'],
    available: true,
  },
  {
    name: 'Cucumber Lemonade',
    category: 'Drinks',
    description: 'Cool and refreshing cucumber lemonade (Regular and 1L available).',
    price: 135,
    variants: ['Regular', '1L'],
    available: true,
  },
  // Hot Coffee
  {
    name: 'Hot Cold Brew Coffee',
    category: 'Drinks',
    description: 'Smooth cold brew served hot.',
    price: 145,
    variants: [],
    available: true,
  },
];

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to DB');

    // Clear existing products
    await Product.deleteMany({});
    console.log('🗑️  Cleared existing products');

    // Insert all products
    const insertedProducts = await Product.insertMany(allProducts);
    console.log(`✅ Successfully added ${insertedProducts.length} products!\n`);

    // Display summary by category
    const categories = [...new Set(allProducts.map(p => p.category))];
    console.log('📦 PRODUCTS BY CATEGORY:\n');

    for (const cat of categories) {
      const catProducts = allProducts.filter(p => p.category === cat);
      console.log(`\n🏷️  ${cat.toUpperCase()} (${catProducts.length} items)`);
      console.log('─'.repeat(60));
      catProducts.forEach(p => {
        if (p.soloPrice) {
          console.log(`   • ${p.name}`);
          console.log(`     └─ Solo: ₱${p.soloPrice} | Platter: ${p.platterPrice ? '₱' + p.platterPrice : 'N/A'}`);
          if (p.variants.length > 0) console.log(`     └─ Variants: ${p.variants.join(', ')}`);
        } else {
          console.log(`   • ${p.name} .......... ₱${p.price}`);
        }
      });
    }

    console.log('\n' + '─'.repeat(60));
    console.log('✅ Seeding completed successfully!');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seedDatabase();
