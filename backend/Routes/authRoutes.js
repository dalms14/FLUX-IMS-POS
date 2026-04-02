const express = require('express');
const router = express.Router();
const User = require('../Models/User');

// Login Route
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Search Atlas for a user with this email
        const user = await User.findOne({ email });

        if (!user || user.password !== password) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // If it matches, send the user data back to React
        res.json({ name: user.name, role: user.role, pin: user.pin });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;