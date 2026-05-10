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
const Refund = require('./models/Refund');
const Inventory = require('./models/Inventory');
const Recipe = require('./models/Recipe');
const SystemAudit = require('./models/SystemAudit');
const Addon = require('./models/Addon');
const Discount = require('./models/Discount');

dotenv.config();

const app = express();
const ALL_CATEGORY_NAME = 'ALL';
const DEFAULT_ADDONS = [
  { name: 'Up size', price: 30 },
  { name: 'Ice Blended', price: 30 },
  { name: 'Cold brew Shot', price: 40 },
  { name: 'Whip Cream', price: 20 },
  { name: 'Milk', price: 30 },
  { name: 'Choco Kisses', price: 25 },
  { name: 'Cream Cheese', price: 25 },
  { name: 'Crushed Oreo', price: 20 },
  { name: 'Cheese Cake', price: 30 },
  { name: 'Nata', price: 20 },
];
const DEFAULT_DISCOUNTS = [
  { name: 'Elite Member', percentage: 20 },
  { name: 'Pag-IBIG', percentage: 20 },
  { name: 'PWD/Senior Citizen', percentage: 20 },
];
const SYSTEM_DISCOUNT_KEYS = new Set(['elite member']);

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

function normalizeAddonName(name = '') {
  return String(name).trim();
}

function normalizeAddonKey(name = '') {
  return normalizeAddonName(name).toLowerCase();
}

function parseAddonPayload(body = {}) {
  const name = normalizeAddonName(body.name);
  const price = Number(body.price);

  if (!name) {
    return { error: 'Add-on name is required' };
  }

  if (!Number.isFinite(price) || price < 0) {
    return { error: 'Add-on price must be 0 or higher' };
  }

  return { addon: { name, nameKey: normalizeAddonKey(name), price } };
}

async function seedDefaultAddons() {
  const count = await Addon.countDocuments({});
  if (count > 0) return;

  try {
    await Addon.insertMany(DEFAULT_ADDONS.map(addon => ({
      ...addon,
      nameKey: normalizeAddonKey(addon.name),
      active: true,
    })), { ordered: false });
  } catch (err) {
    console.error('Default add-on seed warning:', err.message);
  }
}

function normalizeDiscountName(name = '') {
  return String(name).trim();
}

function normalizeDiscountKey(name = '') {
  return normalizeDiscountName(name).toLowerCase();
}

function isSystemDiscountName(name = '') {
  return SYSTEM_DISCOUNT_KEYS.has(normalizeDiscountKey(name));
}

function parseDiscountPayload(body = {}) {
  const name = normalizeDiscountName(body.name);
  const percentage = Number(body.percentage);

  if (!name) {
    return { error: 'Discount name is required' };
  }

  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    return { error: 'Discount % must be between 0 and 100' };
  }

  return { discount: { name, nameKey: normalizeDiscountKey(name), percentage } };
}

async function seedDefaultDiscounts() {
  const count = await Discount.countDocuments({});
  if (count > 0) return;

  try {
    await Discount.insertMany(DEFAULT_DISCOUNTS.map(discount => ({
      ...discount,
      nameKey: normalizeDiscountKey(discount.name),
      active: true,
    })), { ordered: false });
  } catch (err) {
    console.error('Default discount seed warning:', err.message);
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

// --- Add-on Routes ---
app.get('/api/addons', async (req, res) => {
  try {
    await seedDefaultAddons();
    const addons = await Addon.find({ active: true }).sort({ name: 1 }).lean();
    res.json({ success: true, data: addons });
  } catch (err) {
    console.error('Error fetching add-ons:', err);
    res.status(500).json({ message: err.message || 'Failed to fetch add-ons' });
  }
});

app.post('/api/addons', async (req, res) => {
  try {
    const parsed = parseAddonPayload(req.body);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const existing = await Addon.findOne({ nameKey: parsed.addon.nameKey });
    if (existing?.active) {
      return res.status(409).json({ message: 'An add-on with that name already exists' });
    }

    const addon = existing
      ? await Addon.findByIdAndUpdate(existing._id, { ...parsed.addon, active: true }, { returnDocument: 'after', runValidators: true })
      : await Addon.create({ ...parsed.addon, active: true });

    await logSystemAudit({
      module: 'Add-ons',
      action: existing ? 'Restored' : 'Created',
      entityId: addon._id,
      entityName: addon.name,
      details: `Add-on ${existing ? 'restored' : 'created'}`,
      changes: { name: addon.name, price: addon.price },
    });

    res.status(existing ? 200 : 201).json({ success: true, addon });
  } catch (err) {
    console.error('Error saving add-on:', err);
    res.status(500).json({ message: err.message || 'Failed to save add-on' });
  }
});

app.put('/api/addons/:id', async (req, res) => {
  try {
    const parsed = parseAddonPayload(req.body);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const duplicate = await Addon.findOne({
      _id: { $ne: req.params.id },
      nameKey: parsed.addon.nameKey,
      active: true,
    });

    if (duplicate) {
      return res.status(409).json({ message: 'An add-on with that name already exists' });
    }

    const currentAddon = await Addon.findById(req.params.id);
    if (!currentAddon) {
      return res.status(404).json({ message: 'Add-on not found' });
    }

    const addon = await Addon.findByIdAndUpdate(
      req.params.id,
      { ...parsed.addon, active: true },
      { returnDocument: 'after', runValidators: true }
    );

    await Product.updateMany(
      { 'addons.name': currentAddon.name },
      { $set: { 'addons.$[addon].name': addon.name, 'addons.$[addon].price': addon.price } },
      { arrayFilters: [{ 'addon.name': currentAddon.name }] }
    );

    await logSystemAudit({
      module: 'Add-ons',
      action: 'Updated',
      entityId: addon._id,
      entityName: addon.name,
      details: 'Add-on details updated',
      changes: { name: addon.name, price: addon.price },
    });

    res.json({ success: true, addon });
  } catch (err) {
    console.error('Error updating add-on:', err);
    res.status(500).json({ message: err.message || 'Failed to update add-on' });
  }
});

app.delete('/api/addons/:id', async (req, res) => {
  try {
    const addon = await Addon.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { returnDocument: 'after' }
    );

    if (!addon) {
      return res.status(404).json({ message: 'Add-on not found' });
    }

    await Product.updateMany(
      { 'addons.name': addon.name },
      { $pull: { addons: { name: addon.name } } }
    );

    await logSystemAudit({
      module: 'Add-ons',
      action: 'Deleted',
      entityId: addon._id,
      entityName: addon.name,
      details: 'Add-on removed from the master list',
      changes: { name: addon.name, price: addon.price },
    });

    res.json({ success: true, message: `${addon.name} removed` });
  } catch (err) {
    console.error('Error deleting add-on:', err);
    res.status(500).json({ message: 'Failed to delete add-on' });
  }
});

// --- Discount Routes ---
app.get('/api/discounts', async (req, res) => {
  try {
    await seedDefaultDiscounts();
    const discounts = await Discount.find({ active: true }).sort({ name: 1 }).lean();
    res.json({ success: true, data: discounts });
  } catch (err) {
    console.error('Error fetching discounts:', err);
    res.status(500).json({ message: err.message || 'Failed to fetch discounts' });
  }
});

app.post('/api/discounts', async (req, res) => {
  try {
    const parsed = parseDiscountPayload(req.body);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    if (isSystemDiscountName(parsed.discount.name)) {
      return res.status(400).json({ message: 'Elite Member is a system discount and cannot be managed here' });
    }

    const existing = await Discount.findOne({ nameKey: parsed.discount.nameKey });
    if (existing?.active) {
      return res.status(409).json({ message: 'A discount with that name already exists' });
    }

    const discount = existing
      ? await Discount.findByIdAndUpdate(existing._id, { ...parsed.discount, active: true }, { returnDocument: 'after', runValidators: true })
      : await Discount.create({ ...parsed.discount, active: true });

    await logSystemAudit({
      module: 'Discounts',
      action: existing ? 'Restored' : 'Created',
      entityId: discount._id,
      entityName: discount.name,
      details: `Discount ${existing ? 'restored' : 'created'}`,
      changes: { name: discount.name, percentage: discount.percentage },
    });

    res.status(existing ? 200 : 201).json({ success: true, discount });
  } catch (err) {
    console.error('Error saving discount:', err);
    res.status(500).json({ message: err.message || 'Failed to save discount' });
  }
});

app.put('/api/discounts/:id', async (req, res) => {
  try {
    const currentDiscount = await Discount.findById(req.params.id);
    if (!currentDiscount) {
      return res.status(404).json({ message: 'Discount not found' });
    }

    if (isSystemDiscountName(currentDiscount.name)) {
      return res.status(400).json({ message: 'Elite Member is a system discount and cannot be edited' });
    }

    const parsed = parseDiscountPayload(req.body);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    if (isSystemDiscountName(parsed.discount.name)) {
      return res.status(400).json({ message: 'Elite Member is a system discount and cannot be managed here' });
    }

    const duplicate = await Discount.findOne({
      _id: { $ne: req.params.id },
      nameKey: parsed.discount.nameKey,
      active: true,
    });

    if (duplicate) {
      return res.status(409).json({ message: 'A discount with that name already exists' });
    }

    const discount = await Discount.findByIdAndUpdate(
      req.params.id,
      { ...parsed.discount, active: true },
      { returnDocument: 'after', runValidators: true }
    );

    if (!discount) {
      return res.status(404).json({ message: 'Discount not found' });
    }

    await logSystemAudit({
      module: 'Discounts',
      action: 'Updated',
      entityId: discount._id,
      entityName: discount.name,
      details: 'Discount details updated',
      changes: { name: discount.name, percentage: discount.percentage },
    });

    res.json({ success: true, discount });
  } catch (err) {
    console.error('Error updating discount:', err);
    res.status(500).json({ message: err.message || 'Failed to update discount' });
  }
});

app.delete('/api/discounts/:id', async (req, res) => {
  try {
    const currentDiscount = await Discount.findById(req.params.id);
    if (!currentDiscount) {
      return res.status(404).json({ message: 'Discount not found' });
    }

    if (isSystemDiscountName(currentDiscount.name)) {
      return res.status(400).json({ message: 'Elite Member is a system discount and cannot be deleted' });
    }

    const discount = await Discount.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { returnDocument: 'after' }
    );

    if (!discount) {
      return res.status(404).json({ message: 'Discount not found' });
    }

    await logSystemAudit({
      module: 'Discounts',
      action: 'Deleted',
      entityId: discount._id,
      entityName: discount.name,
      details: 'Discount removed from the master list',
      changes: { name: discount.name, percentage: discount.percentage },
    });

    res.json({ success: true, message: `${discount.name} removed` });
  } catch (err) {
    console.error('Error deleting discount:', err);
    res.status(500).json({ message: err.message || 'Failed to delete discount' });
  }
});

// --- Product Routes ---
app.get('/api/products', async (req, res) => {
  try {
    const { category, includeImages } = req.query;
    let query = {};

    if (category && String(category).trim().toUpperCase() !== ALL_CATEGORY_NAME) {
      const categoryName = String(category).trim();
      const cat = await Category.findOne({ name: { $regex: `^${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
      query = cat
        ? { $or: [{ category: categoryName }, { categoryId: cat._id }] }
        : { category: categoryName };
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
      { returnDocument: 'after', upsert: true, runValidators: true }
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
    const productCategory = String(category || '').trim();
    const parsedSoloPrice = soloPrice === '' || soloPrice === undefined ? undefined : Number(soloPrice);
    const normalizedAddons = Array.isArray(addons)
      ? addons
          .filter(addon => addon && addon.name)
          .map(addon => ({
            name: String(addon.name).trim(),
            price: Number(addon.price) || 0,
          }))
      : [];

    if (!name || !productCategory) {
      return res.status(400).json({ message: 'Name and category are required' });
    }

    if (productCategory.toUpperCase() === ALL_CATEGORY_NAME) {
      return res.status(400).json({ message: 'ALL is automatic. Please choose the product category.' });
    }

    const categoryDoc = await Category.findOne({
      name: { $regex: `^${productCategory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
    });

    const newProduct = await Product.create({
      name: name.trim(),
      category: productCategory,
      categoryId: categoryDoc?._id,
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
      details: `Product added under ${productCategory}`,
      changes: { category: productCategory, soloPrice: parsedSoloPrice ?? null, platterPrice: platterPrice || null },
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
    const productCategory = category === undefined ? undefined : String(category || '').trim();
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

    if (productCategory && productCategory.toUpperCase() === ALL_CATEGORY_NAME) {
      return res.status(400).json({ message: 'ALL is automatic. Please choose the product category.' });
    }

    const categoryDoc = productCategory
      ? await Category.findOne({ name: { $regex: `^${productCategory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } })
      : null;

    const update = {
      name,
      category: productCategory,
      categoryId: productCategory ? categoryDoc?._id : undefined,
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
      { returnDocument: 'after' }
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
        await Category.findOneAndUpdate(
            { name: { $regex: `^${ALL_CATEGORY_NAME}$`, $options: 'i' } },
            { name: ALL_CATEGORY_NAME },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );

        const categories = await Category.find({}).lean();
        categories.sort((a, b) => {
            if (a.name === ALL_CATEGORY_NAME) return -1;
            if (b.name === ALL_CATEGORY_NAME) return 1;
            return a.name.localeCompare(b.name);
        });
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

    let receiptNo = `FLX-${datePrefix}-${String(sequence).padStart(4, '0')}`;

    while (await Transaction.exists({ receiptNo })) {
        sequence += 1;
        receiptNo = `FLX-${datePrefix}-${String(sequence).padStart(4, '0')}`;
    }

    return receiptNo;
}

async function generateOrderNo() {
    const now = new Date();
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

    let orderNo = String(sequence).padStart(3, '0');

    while (await Transaction.exists({
        orderNo,
        createdAt: {
            $gte: startOfDay,
            $lte: endOfDay,
        }
    })) {
        sequence += 1;
        orderNo = String(sequence).padStart(3, '0');
    }

    return orderNo;
}

function roundStockAmount(value) {
    return Math.round(Number(value || 0) * 1000) / 1000;
}

async function buildInventoryRequirements(items = []) {
    const requirementMap = new Map();

    for (const item of items) {
        if (!item.productId) continue;

        const recipe = await Recipe.findOne({ productId: item.productId }).lean();
        if (!recipe) continue;

        const quantity = Number(item.quantity || 0);
        if (!Number.isFinite(quantity) || quantity <= 0) continue;

        for (const ingredient of recipe.ingredients || []) {
            if (!ingredient.inventoryId) continue;

            const amountPerServing = Number(ingredient.amountPerServing || 0);
            const platterMultiplier = Number(ingredient.platterMultiplier || 1);
            const multiplier = item.size === 'platter' ? platterMultiplier : 1;
            const requiredAmount = roundStockAmount(amountPerServing * multiplier * quantity);

            if (!Number.isFinite(requiredAmount) || requiredAmount <= 0) continue;

            const key = String(ingredient.inventoryId);
            const existing = requirementMap.get(key) || {
                inventoryId: ingredient.inventoryId,
                name: ingredient.name,
                unit: ingredient.unit,
                required: 0,
                products: [],
            };

            existing.required = roundStockAmount(existing.required + requiredAmount);
            existing.products.push(item.name || recipe.productName);
            requirementMap.set(key, existing);
        }
    }

    return Array.from(requirementMap.values());
}

function buildShortage(requirement, inventoryItem) {
    const available = roundStockAmount(inventoryItem?.stock || 0);

    return {
        inventoryId: requirement.inventoryId,
        name: inventoryItem?.name || requirement.name || 'Inventory item',
        unit: inventoryItem?.unit || requirement.unit || '',
        required: requirement.required,
        available,
        missing: roundStockAmount(requirement.required - available),
        products: [...new Set(requirement.products.filter(Boolean))],
    };
}

// Place Order
app.post('/api/transactions', async (req, res) => {
    const { cashier, cashierEmail, customerType, serviceType, eliteMember, discountInfo, items, subtotal, tax, discount, total, paymentMethod, amountTendered, change, gcashReference, gcashProofImage } = req.body;
    const deductedRequirements = [];
    try {
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Order must contain at least one item.' });
        }

        const normalizedServiceType = serviceType === 'Dine Out' ? 'Dine Out' : 'Dine In';

        const requirements = await buildInventoryRequirements(items);

        if (requirements.length > 0) {
            const inventoryItems = await Inventory.find({
                _id: { $in: requirements.map(requirement => requirement.inventoryId) },
            }).lean();
            const inventoryMap = new Map(inventoryItems.map(item => [String(item._id), item]));

            const shortages = requirements
                .filter(requirement => {
                    const inventoryItem = inventoryMap.get(String(requirement.inventoryId));
                    return !inventoryItem || roundStockAmount(inventoryItem.stock) < requirement.required;
                })
                .map(requirement => buildShortage(requirement, inventoryMap.get(String(requirement.inventoryId))));

            if (shortages.length > 0) {
                return res.status(409).json({
                    success: false,
                    code: 'INSUFFICIENT_STOCK',
                    message: 'Order cannot be processed because one or more ingredients do not have enough stock.',
                    shortages,
                });
            }

            for (const requirement of requirements) {
                const updatedInventory = await Inventory.findOneAndUpdate(
                    {
                        _id: requirement.inventoryId,
                        stock: { $gte: requirement.required },
                    },
                    { $inc: { stock: -requirement.required } },
                    { returnDocument: 'after' }
                );

                if (!updatedInventory) {
                    for (const deducted of deductedRequirements) {
                        await Inventory.findByIdAndUpdate(deducted.inventoryId, { $inc: { stock: deducted.required } });
                    }

                    const latestInventory = await Inventory.findById(requirement.inventoryId).lean();
                    return res.status(409).json({
                        success: false,
                        code: 'INSUFFICIENT_STOCK',
                        message: 'Order cannot be processed because inventory changed before checkout completed.',
                        shortages: [buildShortage(requirement, latestInventory)],
                    });
                }

                deductedRequirements.push(requirement);
            }
        }

        const receiptNo = await generateReceiptNo();
        const orderNo = await generateOrderNo();
        const transaction = await Transaction.create({
            receiptNo, orderNo, orderStatus: 'pending', statusUpdatedAt: new Date(),
            cashier, cashierEmail, customerType, serviceType: normalizedServiceType, eliteMember, discountInfo,
            items, subtotal, tax, discount, total, paymentMethod, amountTendered, change, gcashReference,
            gcashProofImage: paymentMethod === 'GCash' ? gcashProofImage || null : null,
        });

        console.log(`Transaction saved: ${receiptNo} | Order: ${orderNo} | Total: ${total}`);
        res.json({ success: true, receiptNo, orderNo, orderStatus: transaction.orderStatus, transactionId: transaction._id });
    } catch (err) {
        for (const deducted of deductedRequirements) {
            await Inventory.findByIdAndUpdate(deducted.inventoryId, { $inc: { stock: deducted.required } });
        }

        console.error('Transaction error:', err.message);
        res.status(500).json({ message: 'Failed to save transaction.' });
    }
});

// Record checkout cancellations before payment is confirmed.
app.post('/api/transactions/cancelled-checkout', async (req, res) => {
    try {
        const { cashier, cashierEmail, customerType, serviceType, eliteMember, discountInfo, items, subtotal, tax, discount, total, reason } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Cancelled checkout must contain at least one item.' });
        }

        const receiptNo = await generateReceiptNo();
        const normalizedServiceType = serviceType === 'Dine Out' ? 'Dine Out' : 'Dine In';
        const transaction = await Transaction.create({
            receiptNo,
            orderNo: '',
            orderStatus: 'cancelled',
            statusUpdatedAt: new Date(),
            cancelledAt: new Date(),
            cancelledBy: cashier || 'Staff',
            cancelReason: reason || 'Checkout cancelled before payment confirmation',
            cashier,
            cashierEmail,
            customerType,
            serviceType: normalizedServiceType,
            eliteMember,
            discountInfo,
            items,
            subtotal,
            tax,
            discount,
            total,
            paymentMethod: 'Cancelled',
            amountTendered: 0,
            change: 0,
            gcashReference: null,
            gcashProofImage: null,
        });

        await logSystemAudit({
            module: 'Orders',
            action: 'Checkout Cancelled',
            entityId: transaction._id,
            entityName: transaction.receiptNo,
            actor: cashier,
            actorEmail: cashierEmail,
            details: transaction.cancelReason,
            changes: {
                status: 'cancelled',
                total,
                itemCount: items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
            },
        });

        res.json({ success: true, receiptNo, transactionId: transaction._id });
    } catch (err) {
        console.error('Cancelled checkout error:', err.message);
        res.status(500).json({ message: 'Failed to record cancelled checkout.' });
    }
});

// Get all transactions
function annotateTransactionRefundedItems(transaction) {
    const source = transaction.toObject ? transaction.toObject() : transaction;
    const refundedByIndex = new Map();

    for (const cancelled of source.cancelledItems || []) {
        const index = Number(cancelled.originalIndex);
        if (!Number.isInteger(index)) continue;
        refundedByIndex.set(index, (refundedByIndex.get(index) || 0) + Number(cancelled.quantity || 0));
    }

    return {
        ...source,
        items: (source.items || []).map((item, index) => {
            const refundedQuantity = Math.min(Number(item.quantity || 0), refundedByIndex.get(index) || 0);
            return {
                ...item,
                refundedQuantity,
                activeQuantity: Math.max(0, Number(item.quantity || 0) - refundedQuantity),
                refundStatus: refundedQuantity > 0 ? 'completed' : '',
            };
        }),
    };
}

app.get('/api/transactions', async (req, res) => {
    try {
        const { cashier, paymentMethod, startDate, endDate, includeActive } = req.query;
        const filter = {};
        if (includeActive !== 'true') {
            filter.orderStatus = { $in: ['completed', 'cancelled'] };
        }

        if (cashier) filter.cashier = { $regex: cashier, $options: 'i' };
        if (paymentMethod) filter.paymentMethod = paymentMethod;
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        const transactions = await Transaction.find(filter).sort({ createdAt: -1 });
        res.json(transactions.map(annotateTransactionRefundedItems));
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});

const ACTIVE_ORDER_STATUSES = ['pending', 'preparing', 'ready'];
const ORDER_STATUS_TRANSITIONS = {
    pending: ['preparing', 'cancelled'],
    preparing: ['ready'],
    ready: ['completed'],
    completed: [],
    cancelled: [],
};

function roundMoney(value) {
    return Math.round(Number(value || 0) * 100) / 100;
}

function getActiveOrderItems(order) {
    const source = order.toObject ? order.toObject() : order;
    const cancelledByIndex = new Map();

    for (const cancelled of source.cancelledItems || []) {
        const index = Number(cancelled.originalIndex);
        if (!Number.isInteger(index)) continue;
        cancelledByIndex.set(index, (cancelledByIndex.get(index) || 0) + Number(cancelled.quantity || 0));
    }

    return (source.items || [])
        .map((item, index) => {
            const originalQuantity = Number(item.quantity || 0);
            const cancelledQuantity = cancelledByIndex.get(index) || 0;
            const activeQuantity = Math.max(0, originalQuantity - cancelledQuantity);
            if (activeQuantity <= 0) return null;

            const lineSubtotal = Number(item.subtotal || ((item.price || 0) * originalQuantity));
            const unitSubtotal = originalQuantity > 0 ? lineSubtotal / originalQuantity : Number(item.price || 0);

            return {
                ...item,
                originalIndex: index,
                quantity: activeQuantity,
                subtotal: roundMoney(unitSubtotal * activeQuantity),
            };
        })
        .filter(Boolean);
}

function calculateOrderFinancials(order, activeItems) {
    const source = order.toObject ? order.toObject() : order;
    const activeSubtotal = roundMoney(activeItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0));
    const originalSubtotal = Number(source.subtotal || 0);
    const ratio = originalSubtotal > 0 ? activeSubtotal / originalSubtotal : 0;
    const activeTax = roundMoney(Number(source.tax || 0) * ratio);
    const activeDiscount = roundMoney(Number(source.discount || 0) * ratio);
    const activeTotal = roundMoney(Math.max(0, activeSubtotal + activeTax - activeDiscount));

    return { activeSubtotal, activeTax, activeDiscount, activeTotal };
}

function buildOrderResponse(order) {
    const source = order.toObject ? order.toObject() : order;
    const activeItems = getActiveOrderItems(source);
    const financials = calculateOrderFinancials(source, activeItems);

    return {
        ...source,
        items: activeItems,
        originalItems: source.items || [],
        activeSubtotal: financials.activeSubtotal,
        activeTax: financials.activeTax,
        activeDiscount: financials.activeDiscount,
        activeTotal: financials.activeTotal,
    };
}

async function buildRefundPayloadForItems(order, itemsToRefund, reason, actor, actorEmail) {
    const productIds = itemsToRefund.map(item => item.productId).filter(Boolean);
    const madeProducts = await Recipe.find({ productId: { $in: productIds } })
        .select('productId')
        .lean();
    const madeProductIds = new Set(madeProducts.map(recipe => String(recipe.productId)));
    const subtotal = roundMoney(itemsToRefund.reduce((sum, item) => sum + Number(item.subtotal || 0), 0));
    const originalSubtotal = Number(order.subtotal || 0);
    const ratio = originalSubtotal > 0 ? subtotal / originalSubtotal : 0;
    const tax = roundMoney(Number(order.tax || 0) * ratio);
    const discountShare = roundMoney(Number(order.discount || 0) * ratio);
    const totalRefunded = roundMoney(Math.max(0, subtotal + tax - discountShare));

    return {
        transactionId: order._id,
        receiptNo: order.receiptNo,
        items: itemsToRefund.map(item => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.subtotal,
            isMade: madeProductIds.has(String(item.productId)),
        })),
        reason: reason || 'Item refunded before preparation',
        subtotal,
        tax,
        totalRefunded,
        refundedBy: actor || order.cashier || 'System',
        refundedByEmail: actorEmail || order.cashierEmail || '',
        paymentMethod: order.paymentMethod,
        status: 'completed',
    };
}

// Get active orders for staff controls and customer display
app.get('/api/orders/active', async (req, res) => {
    try {
        const orders = await Transaction.find({
            orderStatus: { $in: ACTIVE_ORDER_STATUSES },
        }).sort({ createdAt: 1 });

        res.json({ success: true, orders: orders.map(buildOrderResponse) });
    } catch (err) {
        console.error('Error fetching active orders:', err);
        res.status(500).json({ message: 'Failed to fetch active orders' });
    }
});

// Update order status through Pending -> Preparing -> Ready -> Completed
app.patch('/api/orders/:id/status', async (req, res) => {
    try {
        const { status, actor, actorEmail } = req.body;
        const nextStatus = String(status || '').trim().toLowerCase();

        if (!['preparing', 'ready', 'completed'].includes(nextStatus)) {
            return res.status(400).json({ message: 'Invalid order status' });
        }

        const order = await Transaction.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        const currentStatus = order.orderStatus || 'pending';
        if (!ORDER_STATUS_TRANSITIONS[currentStatus]?.includes(nextStatus)) {
            return res.status(400).json({
                message: `Order cannot move from ${currentStatus} to ${nextStatus}`,
            });
        }

        order.orderStatus = nextStatus;
        order.statusUpdatedAt = new Date();
        await order.save();

        await logSystemAudit({
            module: 'Orders',
            action: 'Status Updated',
            entityId: order._id,
            entityName: order.orderNo || order.receiptNo,
            actor,
            actorEmail,
            details: `Order moved from ${currentStatus} to ${nextStatus}`,
            changes: { oldStatus: currentStatus, newStatus: nextStatus },
        });

        res.json({ success: true, order });
    } catch (err) {
        console.error('Error updating order status:', err);
        res.status(500).json({ message: 'Failed to update order status' });
    }
});

// Cancel a whole order only before preparation starts.
app.post('/api/orders/:id/cancel', async (req, res) => {
    try {
        const { reason, actor, actorEmail } = req.body;
        const order = await Transaction.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        const currentStatus = order.orderStatus || 'pending';
        if (currentStatus !== 'pending') {
            return res.status(400).json({
                message: 'Only pending orders can be cancelled directly. Use the refund/waste process once preparation has started.',
            });
        }

        const activeItems = getActiveOrderItems(order);
        if (activeItems.length === 0) {
            return res.status(400).json({ message: 'This order has no active items to cancel' });
        }

        const requirements = await buildInventoryRequirements(activeItems);
        for (const requirement of requirements) {
            await Inventory.findByIdAndUpdate(requirement.inventoryId, {
                $inc: { stock: requirement.required },
            });
        }

        const refundPayload = await buildRefundPayloadForItems(
            order,
            activeItems,
            reason?.trim() || 'Order cancelled before preparation',
            actor,
            actorEmail
        );
        const refund = await Refund.create(refundPayload);

        order.orderStatus = 'cancelled';
        order.statusUpdatedAt = new Date();
        order.cancelledAt = new Date();
        order.cancelledBy = actor || order.cashier || 'System';
        order.cancelReason = refundPayload.reason;
        order.cancellationRefundId = refund._id;
        order.cancelledItems.push(...activeItems.map(item => ({
            originalIndex: item.originalIndex,
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.subtotal,
            reason: refundPayload.reason,
            cancelledBy: actor || order.cashier || 'System',
            cancelledByEmail: actorEmail || order.cashierEmail || '',
            refundId: refund._id,
            cancelledAt: order.cancelledAt,
        })));
        await order.save();

        await logSystemAudit({
            module: 'Orders',
            action: 'Cancelled',
            entityId: order._id,
            entityName: order.orderNo || order.receiptNo,
            actor,
            actorEmail,
            details: refundPayload.reason,
            changes: {
                oldStatus: currentStatus,
                newStatus: 'cancelled',
                refundId: refund._id,
                restoredInventory: requirements.map(item => ({
                    inventoryId: item.inventoryId,
                    name: item.name,
                    quantity: item.required,
                    unit: item.unit,
                })),
            },
        });

        res.json({ success: true, order, refund });
    } catch (err) {
        console.error('Error cancelling order:', err);
        res.status(500).json({ message: 'Failed to cancel order' });
    }
});

// Remove specific items from a pending order and record them as a completed refund.
app.post('/api/orders/:id/cancel-items', async (req, res) => {
    try {
        const { items = [], reason, actor, actorEmail } = req.body;
        const order = await Transaction.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        const currentStatus = order.orderStatus || 'pending';
        if (currentStatus !== 'pending') {
            return res.status(400).json({
                message: 'Items can only be removed while the order is still pending.',
            });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Select at least one item to remove' });
        }

        const activeItems = getActiveOrderItems(order);
        const activeByIndex = new Map(activeItems.map(item => [Number(item.originalIndex), item]));
        const selectedItems = [];

        for (const selected of items) {
            const originalIndex = Number(selected.originalIndex);
            if (!Number.isInteger(originalIndex) || !activeByIndex.has(originalIndex)) {
                return res.status(400).json({ message: 'One or more selected items are no longer active on this order' });
            }

            const activeItem = activeByIndex.get(originalIndex);
            const requestedQuantity = Number(selected.quantity || activeItem.quantity);
            if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0 || requestedQuantity > Number(activeItem.quantity || 0)) {
                return res.status(400).json({ message: `Invalid quantity for ${activeItem.name}` });
            }

            const unitSubtotal = Number(activeItem.quantity || 0) > 0
                ? Number(activeItem.subtotal || 0) / Number(activeItem.quantity || 1)
                : Number(activeItem.price || 0);

            selectedItems.push({
                ...activeItem,
                originalIndex,
                quantity: requestedQuantity,
                subtotal: roundMoney(unitSubtotal * requestedQuantity),
            });
        }

        const requirements = await buildInventoryRequirements(selectedItems);
        for (const requirement of requirements) {
            await Inventory.findByIdAndUpdate(requirement.inventoryId, {
                $inc: { stock: requirement.required },
            });
        }

        const refundPayload = await buildRefundPayloadForItems(
            order,
            selectedItems,
            reason?.trim() || 'Item refunded before preparation',
            actor,
            actorEmail
        );
        const refund = await Refund.create(refundPayload);

        const cancelledAt = new Date();
        order.cancelledItems.push(...selectedItems.map(item => ({
            originalIndex: item.originalIndex,
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.subtotal,
            reason: refundPayload.reason,
            cancelledBy: actor || order.cashier || 'System',
            cancelledByEmail: actorEmail || order.cashierEmail || '',
            refundId: refund._id,
            cancelledAt,
        })));

        const remainingItems = getActiveOrderItems(order);
        if (remainingItems.length === 0) {
            order.orderStatus = 'cancelled';
            order.statusUpdatedAt = cancelledAt;
            order.cancelledAt = cancelledAt;
            order.cancelledBy = actor || order.cashier || 'System';
            order.cancelReason = refundPayload.reason;
            order.cancellationRefundId = refund._id;
        }

        await order.save();

        await logSystemAudit({
            module: 'Orders',
            action: remainingItems.length === 0 ? 'Cancelled' : 'Item Refunded',
            entityId: order._id,
            entityName: order.orderNo || order.receiptNo,
            actor,
            actorEmail,
            details: `${selectedItems.map(item => `${item.name} x${item.quantity}`).join(', ')} - ${refundPayload.reason}`,
            changes: {
                refundId: refund._id,
                removedItems: selectedItems.map(item => ({
                    name: item.name,
                    quantity: item.quantity,
                    subtotal: item.subtotal,
                })),
                restoredInventory: requirements.map(item => ({
                    inventoryId: item.inventoryId,
                    name: item.name,
                    quantity: item.required,
                    unit: item.unit,
                })),
            },
        });

        res.json({ success: true, order: buildOrderResponse(order), refund });
    } catch (err) {
        console.error('Error removing order item:', err);
        res.status(500).json({ message: 'Failed to remove order item' });
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
        const { name, unit, stock, lowStockAt, category, actor, actorEmail } = req.body;
        const stockValue = Number(stock) || 0;
        const lowStockValue = Number(lowStockAt) || 500;
        
        if (!name || !unit) {
            return res.status(400).json({ message: 'Name and unit are required' });
        }

        if (stockValue < 0) {
            return res.status(400).json({ message: 'Stock cannot be negative' });
        }

        const newItem = await Inventory.create({
            name: name.trim(),
            unit,
            stock: stockValue,
            lowStockAt: lowStockValue,
            category: category || 'General',
        });

        console.log(`✅ Inventory item added: ${newItem.name}`);
        await logSystemAudit({
            module: 'Inventory',
            action: 'Created',
            entityId: newItem._id,
            entityName: newItem.name,
            actor,
            actorEmail,
            details: 'Inventory item added',
            changes: { unit, stock: stockValue, lowStockAt: lowStockValue, category: category || 'General' },
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
        const { name, unit, lowStockAt, category, actor, actorEmail } = req.body;
        const lowStockValue = Number(lowStockAt) || 500;

        if (!name || !unit) {
            return res.status(400).json({ message: 'Name and unit are required' });
        }

        if (Object.prototype.hasOwnProperty.call(req.body, 'stock')) {
            return res.status(400).json({
                message: 'Stock cannot be edited directly. Use Stock In for new supplies; sales transactions deduct stock automatically.'
            });
        }

        const update = {
            name: name.trim(),
            unit: unit.trim(),
            lowStockAt: lowStockValue,
            category: category?.trim() || 'General',
        };
        
        const updatedItem = await Inventory.findByIdAndUpdate(
            req.params.id,
            update,
            { returnDocument: 'after', runValidators: true }
        );

        if (!updatedItem) return res.status(404).json({ message: 'Item not found' });
        
        console.log(`✅ Inventory item updated: ${updatedItem.name}`);
        await logSystemAudit({
            module: 'Inventory',
            action: 'Updated',
            entityId: updatedItem._id,
            entityName: updatedItem.name,
            actor,
            actorEmail,
            details: 'Inventory item details updated',
            changes: update,
        });
        res.json({ success: true, item: updatedItem });
    } catch (err) {
        console.error('Error updating inventory item:', err);
        res.status(500).json({ message: 'Failed to update item' });
    }
});

async function stockInInventoryItem(req, res) {
    try {
        let { quantity, adjustment, reason, actor, actorEmail } = req.body;
        const stockInQuantity = Number(quantity ?? adjustment);
        
        if (!Number.isFinite(stockInQuantity) || stockInQuantity <= 0) {
            return res.status(400).json({ message: 'Stock-in quantity must be greater than 0' });
        }

        const item = await Inventory.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Item not found' });

        const oldStock = item.stock;
        item.stock += stockInQuantity;
        adjustment = stockInQuantity;

        await item.save();

        console.log(`Stock in: ${item.name} | ${oldStock} -> ${item.stock} (+${stockInQuantity}) | Reason: ${reason || 'New supplies received'}`);
        
        await logSystemAudit({
            module: 'Inventory',
            action: 'Stock In',
            entityId: item._id,
            entityName: item.name,
            actor,
            actorEmail,
            details: reason || 'New supplies received',
            changes: { oldStock, newStock: item.stock, quantity: stockInQuantity },
        });

        res.json({ 
            success: true, 
            item,
            change: {
                oldStock,
                newStock: item.stock,
                quantity: stockInQuantity,
                reason: reason || 'New supplies received'
            }
        });
    } catch (err) {
        console.error('Error adding stock:', err);
        res.status(500).json({ message: 'Failed to add stock' });
    }
}

// Add received stock for an inventory item.
app.put('/api/inventory/:id/stock-in', stockInInventoryItem);

// Backward-compatible route: manual stock changes can only increase stock.
app.put('/api/inventory/:id/adjust-stock', stockInInventoryItem);

// Deduct damaged, lost, stolen, expired, or counted-down stock.
app.put('/api/inventory/:id/stock-out', async (req, res) => {
    try {
        const { quantity, adjustment, reason, actor, actorEmail } = req.body;
        const stockOutQuantity = Number(quantity ?? adjustment);

        if (!Number.isFinite(stockOutQuantity) || stockOutQuantity <= 0) {
            return res.status(400).json({ message: 'Stock-out quantity must be greater than 0' });
        }

        if (!reason || !String(reason).trim()) {
            return res.status(400).json({ message: 'Stock-out reason is required' });
        }

        const item = await Inventory.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Item not found' });

        if (Number(item.stock || 0) < stockOutQuantity) {
            return res.status(400).json({
                message: `Cannot deduct ${stockOutQuantity} ${item.unit}. Only ${item.stock} ${item.unit} available.`,
            });
        }

        const oldStock = item.stock;
        item.stock = roundStockAmount(Number(item.stock || 0) - stockOutQuantity);
        await item.save();

        console.log(`Stock out: ${item.name} | ${oldStock} -> ${item.stock} (-${stockOutQuantity}) | Reason: ${reason}`);

        await logSystemAudit({
            module: 'Inventory',
            action: 'Stock Out',
            entityId: item._id,
            entityName: item.name,
            actor,
            actorEmail,
            details: String(reason).trim(),
            changes: {
                oldStock,
                newStock: item.stock,
                quantity: stockOutQuantity,
                reason: String(reason).trim(),
                unit: item.unit,
            },
        });

        res.json({
            success: true,
            item,
            change: {
                oldStock,
                newStock: item.stock,
                quantity: stockOutQuantity,
                reason: String(reason).trim(),
            },
        });
    } catch (err) {
        console.error('Error deducting stock:', err);
        res.status(500).json({ message: 'Failed to deduct stock' });
    }
});

// Delete inventory item
app.delete('/api/inventory/:id', async (req, res) => {
    try {
        const { actor, actorEmail } = req.body || {};
        const item = await Inventory.findByIdAndDelete(req.params.id);
        if (!item) return res.status(404).json({ message: 'Item not found' });
        
        console.log(`✅ Inventory item deleted: ${item.name}`);
        await logSystemAudit({
            module: 'Inventory',
            action: 'Deleted',
            entityId: item._id,
            entityName: item.name,
            actor,
            actorEmail,
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
