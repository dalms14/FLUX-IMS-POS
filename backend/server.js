const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

dotenv.config();

const app = express();

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Connect to MongoDB Atlas ---
console.log("Connecting to Database...");

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected Successfully"))
    .catch(err => {
        console.log("❌ Connection Failed!");
        console.error("Error Detail:", err.message);
    });

// --- Routes ---

// Login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    console.log("--- Login Attempt ---", email);

    try {
        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user) {
            console.log("❌ No user found");
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // Use bcryptjs directly instead of the model method
        const isMatch = await bcrypt.compare(password, user.password);
        console.log("Password match:", isMatch);

        if (!isMatch) {
            console.log("❌ Password mismatch");
            return res.status(401).json({ message: "Invalid email or password" });
        }

        console.log("✅ Login Successful:", user.name);
        res.json({
            name: user.name,
            email: user.email,
            role: user.role
        });

    } catch (err) {
        console.error("Server Error:", err.message);
        res.status(500).json({ message: "Server Error" });
    }
});

// PIN Login (for quick POS access)
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    console.log("--- Login Attempt ---");
    console.log("Email received:", email);
    console.log("Password received:", password);

    try {
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        console.log("User found in DB:", user);

        if (!user) {
            console.log("❌ No user found");
            return res.status(401).json({ message: "Invalid email or password" });
        }

        console.log("Stored hashed password:", user.password);

        const bcrypt = require('bcryptjs');
        const isMatch = await bcrypt.compare(password, user.password);
        console.log("Password match result:", isMatch);

        if (!isMatch) {
            console.log("❌ Password mismatch");
            return res.status(401).json({ message: "Invalid email or password" });
        }

        console.log("✅ Login Successful:", user.name);
        res.json({ name: user.name, email: user.email, role: user.role });

    } catch (err) {
        console.error("Server Error:", err.message);
        res.status(500).json({ message: "Server Error" });
    }
});

// --- Start Server ---
const PORT = process.env.PORT || 5000;
const Product = require('./models/Product');

// Get all products
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find({});
        res.json(products);
    } catch (err) {
        console.error("Error fetching products:", err);
        res.status(500).json({ message: "Server Error" });
    }
});

// Get products by category
app.get('/api/products/:category', async (req, res) => {
    try {
        const products = await Product.find({ category: req.params.category });
        res.json(products);
    } catch (err) {
        console.error("Error fetching products:", err);
        res.status(500).json({ message: "Server Error" });
    }
});
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));