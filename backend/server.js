const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Product = require('./models/Product');
const Category = require('./models/Category');
const authRoutes = require('./Routes/authRoutes');
const historyRoutes = require('./Routes/historyRoutes');
const Transaction = require('./models/Transaction');
const Inventory = require('./models/Inventory');
const Recipe = require('./models/Recipe');
const SystemAudit = require('./models/SystemAudit');

dotenv.config();

const app = express();

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use('/api/auth', authRoutes);
app.use('/api', historyRoutes);

// --- Connect to MongoDB Atlas ---
console.log("Connecting to Database...");
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected Successfully"))
    .catch(err => {
        console.log("❌ Connection Failed!");
        console.error("Error Detail:", err.message);
    });

// --- Auth Routes ---

// Login attempt tracking (in-memory)
const loginAttempts = new Map();

const MAX_ATTEMPTS = 3;
const LOCKOUT_DURATION = 30 * 1000; // 30 seconds in ms

// Email & Password Login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    console.log("--- Login Attempt ---", email);

    // Check for lockout
    const attemptKey = email.toLowerCase().trim();
    const attempts = loginAttempts.get(attemptKey);
    
    if (attempts && attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
        const remainingSeconds = Math.ceil((attempts.lockedUntil - Date.now()) / 1000);
        console.log("⏳ Account locked:", attemptKey);
        return res.status(423).json({ 
            message: `Too many failed attempts. Please try again in ${remainingSeconds} seconds.`,
            locked: true,
            remainingSeconds
        });
    }

    try {
        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user) {
            // Track failed attempt
            trackFailedAttempt(attemptKey);
            console.log("❌ No user found");
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        console.log("Password match:", isMatch);

        if (!isMatch) {
            // Track failed attempt
            trackFailedAttempt(attemptKey);
            console.log("❌ Password mismatch");
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // Clear attempts on successful login
        loginAttempts.delete(attemptKey);
        
        console.log("✅ Login Successful:", user.name);
        res.json({ name: user.name, email: user.email, role: user.role });

    } catch (err) {
        console.error("Server Error:", err.message);
        res.status(500).json({ message: "Server Error" });
    }
});

// Helper function to track failed login attempts
function trackFailedAttempt(key) {
    const now = Date.now();
    let attempts = loginAttempts.get(key) || { count: 0, lockedUntil: null };
    
    attempts.count += 1;
    
    if (attempts.count >= MAX_ATTEMPTS) {
        attempts.lockedUntil = now + LOCKOUT_DURATION;
        console.log(`🔒 Account locked for 30 seconds: ${key}`);
    }
    
    loginAttempts.set(key, attempts);
}

// Check lockout status endpoint
app.get('/api/auth/lockout-status', (req, res) => {
    const { email } = req.query;
    if (!email) return res.json({ locked: false });
    
    const attemptKey = email.toLowerCase().trim();
    const attempts = loginAttempts.get(attemptKey);
    
    if (attempts && attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
        const remainingSeconds = Math.ceil((attempts.lockedUntil - Date.now()) / 1000);
        return res.json({ 
            locked: true, 
            remainingSeconds,
            attemptsRemaining: 0
        });
    }
    
    const remaining = MAX_ATTEMPTS - (attempts?.count || 0);
    res.json({ 
        locked: false, 
        attemptsRemaining: Math.max(0, remaining)
    });
});

// PIN Login

function parseAuditEndDate(value) {
  const end = new Date(value);
  if (!String(value).includes('T')) {
    end.setHours(23, 59, 59, 999);
  }
  return end;
}

async function logSystemAudit({ module, action, entityId = '', entityName = '', actor = 'System', actorEmail = '', details = '', changes = {} }) {
  try {
    await SystemAudit.create({
      module,
      action,
      entityId: String(entityId || ''),
      entityName: entityName || '',
      actor: actor || 'System',
      actorEmail: actorEmail || '',
      details: details || '',
      changes,
    });
  } catch (err) {
    console.error('System audit error:', err.message);
  }
}

app.get('/api/system-audit', async (req, res) => {
  try {
    const { module, startDate, endDate } = req.query;
    const filter = {};

    if (module) filter.module = module;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = parseAuditEndDate(endDate);
    }

    const logs = await SystemAudit.find(filter)
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    console.error('Error fetching system audit:', err);
    res.status(500).json({ message: 'Failed to fetch system audit' });
  }
});

// --- Product Routes ---
app.get('/api/products', async (req, res) => {
  try {
    const { category, includeImages } = req.query;
    let query = {};

    if (category) {
      const cat = await Category.findOne({ name: category });
      if (cat) query.categoryId = cat._id;
    }

    // Only include image when explicitly requested
    const projection = includeImages === 'true' ? {} : { image: 0 };

    const products = await Product.find(query, projection).populate('categoryId');
    res.status(200).json(products);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

// Separate route to get single product WITH image
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('categoryId');
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

// Get recipe/ingredient mapping for a product
app.get('/api/products/:id/recipe', async (req, res) => {
  try {
    const recipe = await Recipe.findOne({ productId: req.params.id })
      .populate('ingredients.inventoryId', 'name unit category stock lowStockAt')
      .lean();

    res.json({ success: true, recipe: recipe || null });
  } catch (err) {
    console.error('Error fetching recipe:', err);
    res.status(500).json({ message: 'Failed to fetch recipe' });
  }
});

// Create or update recipe/ingredient mapping for a product
app.put('/api/products/:id/recipe', async (req, res) => {
  try {
    const { ingredients } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (!Array.isArray(ingredients)) {
      return res.status(400).json({ message: 'Ingredients must be an array' });
    }

    const inventoryIds = ingredients
      .map(ingredient => ingredient.inventoryId)
      .filter(Boolean);

    const inventoryItems = await Inventory.find({ _id: { $in: inventoryIds } }).lean();
    const inventoryMap = new Map(inventoryItems.map(item => [String(item._id), item]));

    const normalizedIngredients = ingredients
      .map(ingredient => {
        const inventoryItem = inventoryMap.get(String(ingredient.inventoryId));
        const amountPerServing = Number(ingredient.amountPerServing);
        const platterMultiplier = Number(ingredient.platterMultiplier);

        if (!inventoryItem || !Number.isFinite(amountPerServing) || amountPerServing <= 0) {
          return null;
        }

        return {
          inventoryId: inventoryItem._id,
          name: inventoryItem.name,
          amountPerServing,
          unit: inventoryItem.unit,
          platterMultiplier: Number.isFinite(platterMultiplier) && platterMultiplier > 0 ? platterMultiplier : 3,
        };
      })
      .filter(Boolean);

    const recipe = await Recipe.findOneAndUpdate(
      { productId: product._id },
      {
        productId: product._id,
        productName: product.name,
        ingredients: normalizedIngredients,
      },
      { new: true, upsert: true, runValidators: true }
    );

    await logSystemAudit({
      module: 'Recipes',
      action: 'Updated',
      entityId: product._id,
      entityName: product.name,
      details: `${normalizedIngredients.length} ingredient deduction rule(s) saved`,
      changes: {
        ingredients: normalizedIngredients.map(ingredient => ({
          name: ingredient.name,
          amountPerServing: ingredient.amountPerServing,
          unit: ingredient.unit,
          platterMultiplier: ingredient.platterMultiplier,
        })),
      },
    });

    res.json({ success: true, recipe });
  } catch (err) {
    console.error('Error saving recipe:', err);
    res.status(500).json({ message: 'Failed to save recipe' });
  }
});

// Create Product
app.post('/api/products', async (req, res) => {
  try {
    const { name, category, description, soloPrice, platterPrice, variants, addons, image } = req.body;
    const parsedSoloPrice = soloPrice === '' || soloPrice === undefined ? undefined : Number(soloPrice);
    const normalizedAddons = Array.isArray(addons)
      ? addons
          .filter(addon => addon && addon.name)
          .map(addon => ({
            name: String(addon.name).trim(),
            price: Number(addon.price) || 0,
          }))
      : [];

    if (!name || !category) {
      return res.status(400).json({ message: 'Name and category are required' });
    }

    const newProduct = await Product.create({
      name: name.trim(),
      category,
      description: description || '',
      soloPrice: parsedSoloPrice ?? null,
      price: parsedSoloPrice,
      platterPrice: platterPrice || null,
      variants: variants || [],
      addons: normalizedAddons,
      image: image || null,
      available: true,
    });

    console.log(`✅ Product created: ${newProduct.name}`);
    await logSystemAudit({
      module: 'Products',
      action: 'Created',
      entityId: newProduct._id,
      entityName: newProduct.name,
      details: `Product added under ${category}`,
      changes: { category, soloPrice: parsedSoloPrice ?? null, platterPrice: platterPrice || null },
    });
    res.status(201).json({ success: true, product: newProduct });
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ message: 'Failed to create product' });
  }
});

// Update Product
app.put('/api/products/:id', async (req, res) => {
  try {
    const { name, category, description, soloPrice, platterPrice, variants, addons, image, available } = req.body;
    const parsedSoloPrice = soloPrice === '' || soloPrice === undefined ? undefined : Number(soloPrice);
    const parsedPlatterPrice = platterPrice === '' || platterPrice === undefined ? null : platterPrice;
    const normalizedAddons = Array.isArray(addons)
      ? addons
          .filter(addon => addon && addon.name)
          .map(addon => ({
            name: String(addon.name).trim(),
            price: Number(addon.price) || 0,
          }))
      : undefined;

    const update = {
      name,
      category,
      description,
      soloPrice: parsedSoloPrice,
      price: parsedSoloPrice,
      platterPrice: parsedPlatterPrice,
      variants: Array.isArray(variants) ? variants : [],
      addons: normalizedAddons,
      image,
      available,
    };

    Object.keys(update).forEach(key => update[key] === undefined && delete update[key]);

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    console.log(`✅ Product updated: ${updatedProduct.name}`);
    await logSystemAudit({
      module: 'Products',
      action: 'Updated',
      entityId: updatedProduct._id,
      entityName: updatedProduct.name,
      details: 'Product details updated',
      changes: update,
    });
    res.json({ success: true, product: updatedProduct });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ message: 'Failed to update product' });
  }
});

// Delete Product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);

    if (!deletedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    console.log(`✅ Product deleted: ${deletedProduct.name}`);
    await logSystemAudit({
      module: 'Products',
      action: 'Deleted',
      entityId: deletedProduct._id,
      entityName: deletedProduct.name,
      details: 'Product removed from menu',
      changes: { category: deletedProduct.category, soloPrice: deletedProduct.soloPrice },
    });
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ message: 'Failed to delete product' });
  }
});

// Verify identity for forgot password
app.post('/api/auth/verify-identity', async (req, res) => {
  try {
    const { email, userId } = req.body;

    const user = await User.findOne({
      email: email.toLowerCase(),
      userId: userId
    });

    if (!user) {
      return res.json({ verified: false });
    }

    res.json({ verified: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ verified: false });
  }
});

// Reset password
app.post('/api/auth/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;
  try {
    const hashed = await bcrypt.hash(newPassword, 10);
    await User.findOneAndUpdate({ email }, { password: hashed });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// app.get('/api/products/category/:category', async (req, res) => {
//     try {
//         const products = await Product.find({ category: req.params.category });
//         res.json(products);
//     } catch (err) {
//         console.error("Error fetching products:", err);
//         res.status(500).json({ message: "Server Error" });
//     }
// });

app.get('/api/categories', async (req, res) => {
    try {
        const categories = await Category.find({});
        res.json(categories);
    } catch (err) {
        console.error("Error fetching categories:", err);
        res.status(500).json({ message: "Server Error" });
    }
});

app.post('/api/categories', async (req, res) => {
    try {
        const { name } = req.body;
        const categoryName = String(name || '').trim();

        if (!categoryName) {
            return res.status(400).json({ message: 'Category name is required' });
        }

        const existingCategory = await Category.findOne({
            name: { $regex: `^${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
        });

        if (existingCategory) {
            return res.status(409).json({ message: 'Category already exists' });
        }

        const category = await Category.create({ name: categoryName });
        await logSystemAudit({
            module: 'Categories',
            action: 'Created',
            entityId: category._id,
            entityName: category.name,
            details: 'Menu category added',
        });
        res.status(201).json({ success: true, category });
    } catch (err) {
        console.error('Error creating category:', err);
        res.status(500).json({ message: 'Failed to create category' });
    }
});

async function generateReceiptNo() {
    const now = new Date();
    const datePrefix = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
    ].join('');

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    let sequence = await Transaction.countDocuments({
        createdAt: {
            $gte: startOfDay,
            $lte: endOfDay,
        }
    }) + 1;

    let receiptNo = `RCPT-${datePrefix}-${String(sequence).padStart(3, '0')}`;

    while (await Transaction.exists({ receiptNo })) {
        sequence += 1;
        receiptNo = `RCPT-${datePrefix}-${String(sequence).padStart(3, '0')}`;
    }

    return receiptNo;
}

// Place Order
app.post('/api/transactions', async (req, res) => {
    const { cashier, cashierEmail, customerType, eliteMember, items, subtotal, tax, discount, total, paymentMethod, amountTendered, change } = req.body;
    try {
        const receiptNo = await generateReceiptNo();
        const transaction = await Transaction.create({
            receiptNo, cashier, cashierEmail, customerType, eliteMember,
            items, subtotal, tax, discount, total, paymentMethod, amountTendered, change,
        });

        // Deduct ingredients
        for (const item of items) {
            const recipe = await Recipe.findOne({ productId: item.productId });
            if (!recipe) continue;
            for (const ing of recipe.ingredients) {
                const multiplier = item.size === 'platter' ? ing.platterMultiplier : 1;
                const amountToDeduct = ing.amountPerServing * multiplier * item.quantity;
                await Inventory.findByIdAndUpdate(ing.inventoryId, { $inc: { stock: -amountToDeduct } });
            }
        }

        console.log(`✅ Transaction saved: ${receiptNo} | Total: ₱${total}`);
        res.json({ success: true, receiptNo, transactionId: transaction._id });
    } catch (err) {
        console.error('Transaction error:', err.message);
        res.status(500).json({ message: 'Failed to save transaction.' });
    }
});

// Get all transactions
app.get('/api/transactions', async (req, res) => {
    try {
        const transactions = await Transaction.find({}).sort({ createdAt: -1 });
        res.json(transactions);
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// Get inventory
app.get('/api/inventory', async (req, res) => {
    try {
        const inventory = await Inventory.find({}).sort({ category: 1, name: 1 });
        res.json(inventory);
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// Get single inventory item
app.get('/api/inventory/:id', async (req, res) => {
    try {
        const item = await Inventory.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Item not found' });
        res.json(item);
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// Add new inventory item
app.post('/api/inventory', async (req, res) => {
    try {
        const { name, unit, stock, lowStockAt, category } = req.body;
        
        if (!name || !unit) {
            return res.status(400).json({ message: 'Name and unit are required' });
        }

        const newItem = await Inventory.create({
            name: name.trim(),
            unit,
            stock: stock || 0,
            lowStockAt: lowStockAt || 500,
            category: category || 'General',
        });

        console.log(`✅ Inventory item added: ${newItem.name}`);
        await logSystemAudit({
            module: 'Inventory',
            action: 'Created',
            entityId: newItem._id,
            entityName: newItem.name,
            details: 'Inventory item added',
            changes: { unit, stock: stock || 0, lowStockAt: lowStockAt || 500, category: category || 'General' },
        });
        res.status(201).json({ success: true, item: newItem });
    } catch (err) {
        console.error('Error adding inventory item:', err);
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Item name already exists' });
        }
        res.status(500).json({ message: 'Failed to add item' });
    }
});

// Update inventory item
app.put('/api/inventory/:id', async (req, res) => {
    try {
        const { name, unit, stock, lowStockAt, category } = req.body;

        if (!name || !unit) {
            return res.status(400).json({ message: 'Name and unit are required' });
        }

        const update = {
            name: name.trim(),
            unit: unit.trim(),
            stock: Number(stock) || 0,
            lowStockAt: Number(lowStockAt) || 500,
            category: category?.trim() || 'General',
        };
        
        const updatedItem = await Inventory.findByIdAndUpdate(
            req.params.id,
            update,
            { new: true, runValidators: true }
        );

        if (!updatedItem) return res.status(404).json({ message: 'Item not found' });
        
        console.log(`✅ Inventory item updated: ${updatedItem.name}`);
        await logSystemAudit({
            module: 'Inventory',
            action: 'Updated',
            entityId: updatedItem._id,
            entityName: updatedItem.name,
            details: 'Inventory item details updated',
            changes: update,
        });
        res.json({ success: true, item: updatedItem });
    } catch (err) {
        console.error('Error updating inventory item:', err);
        res.status(500).json({ message: 'Failed to update item' });
    }
});

// Adjust stock for inventory item
app.put('/api/inventory/:id/adjust-stock', async (req, res) => {
    try {
        const { adjustment, reason } = req.body;
        
        if (adjustment === undefined || adjustment === null) {
            return res.status(400).json({ message: 'Adjustment amount is required' });
        }

        const item = await Inventory.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Item not found' });

        const oldStock = item.stock;
        item.stock += adjustment;

        if (item.stock < 0) {
            return res.status(400).json({ message: 'Stock cannot go below 0' });
        }

        await item.save();

        console.log(`✅ Stock adjusted: ${item.name} | ${oldStock} → ${item.stock} (${adjustment > 0 ? '+' : ''}${adjustment}) | Reason: ${reason || 'Manual'}`);
        
        await logSystemAudit({
            module: 'Inventory',
            action: 'Stock Adjusted',
            entityId: item._id,
            entityName: item.name,
            details: reason || 'Manual adjustment',
            changes: { oldStock, newStock: item.stock, adjustment },
        });

        res.json({ 
            success: true, 
            item,
            change: {
                oldStock,
                newStock: item.stock,
                adjustment,
                reason: reason || 'Manual adjustment'
            }
        });
    } catch (err) {
        console.error('Error adjusting stock:', err);
        res.status(500).json({ message: 'Failed to adjust stock' });
    }
});

// Delete inventory item
app.delete('/api/inventory/:id', async (req, res) => {
    try {
        const item = await Inventory.findByIdAndDelete(req.params.id);
        if (!item) return res.status(404).json({ message: 'Item not found' });
        
        console.log(`✅ Inventory item deleted: ${item.name}`);
        await logSystemAudit({
            module: 'Inventory',
            action: 'Deleted',
            entityId: item._id,
            entityName: item.name,
            details: 'Inventory item deleted',
            changes: { stock: item.stock, unit: item.unit, category: item.category },
        });
        res.json({ success: true, message: `${item.name} deleted` });
    } catch (err) {
        console.error('Error deleting inventory item:', err);
        res.status(500).json({ message: 'Failed to delete item' });
    }
});

// Get inventory stats/KPIs
app.get('/api/inventory-stats', async (req, res) => {
    try {
        const items = await Inventory.find({});
        
        const totalItems = items.length;
        const lowStockItems = items.filter(item => item.stock <= item.lowStockAt);
        const outOfStockItems = items.filter(item => item.stock === 0);
        const totalValue = items.reduce((sum, item) => sum + item.stock, 0);

        res.json({
            totalItems,
            lowStockCount: lowStockItems.length,
            outOfStockCount: outOfStockItems.length,
            totalInventoryValue: totalValue,
            lowStockItems,
            outOfStockItems,
        });
    } catch (err) {
        console.error('Error fetching inventory stats:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});
// --- Start Server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
