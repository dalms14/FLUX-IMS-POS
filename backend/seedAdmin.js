require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function seed() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to DB");

    // Hash the password manually - bypasses the pre-save hook entirely
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Use raw mongoose collection - bypasses the model and hooks completely
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    await usersCollection.deleteOne({ email: 'admin@elicoffee.com' });

    await usersCollection.insertOne({
        name: 'Staff',
        email: 'admin@elicoffee.com',
        password: hashedPassword,
        pin: '1234',
        role: 'admin',
        userId: 'ELI001',
        createdAt: new Date(),
        updatedAt: new Date()
    });

    console.log("✅ Admin re-seeded with hashed password!");
    process.exit();
}

seed().catch(err => {
    console.error("❌ Seed failed:", err.message);
    process.exit(1);
});