require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function createUser() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to DB');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // ── Edit these details ──
    const name = 'staff1';
    const email = 'staff1@elicoffee.com';
    const password = 'staff12345';
    const pin = '1234';
    const role = 'staff'; // 'admin' or 'staff'
    const userId = 'ELI004';
    // ────────────────────────

    const hashedPassword = await bcrypt.hash(password, 10);

    await usersCollection.insertOne({
        name,
        email,
        password: hashedPassword,
        pin,
        role,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    console.log(`✅ User created: ${name} (${email}) — Role: ${role}`);
    process.exit();
}

createUser().catch(err => {
    console.error('❌ Failed:', err.message);
    process.exit(1);
});