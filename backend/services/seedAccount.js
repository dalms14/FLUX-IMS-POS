const mongoose = require('mongoose');
const User = require('../models/User');

function seedConfiguration(env, owner = false) {
    const prefix = owner ? 'SEED_OWNER_' : 'SEED_USER_';
    const password = env[`${prefix}PASSWORD`];
    const email = String(env[`${prefix}EMAIL`] || (owner ? 'admin@elicoffee.com' : '')).trim().toLowerCase();
    const name = String(env[`${prefix}NAME`] || (owner ? 'Owner' : '')).trim();
    const userId = String(env[`${prefix}ID`] || (owner ? 'ELI001' : '')).trim().toUpperCase();
    const pin = env[`${prefix}PIN`];
    if (!email || !name || !userId || typeof password !== 'string' || password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
        throw new Error(`Set ${prefix}NAME, EMAIL, ID and a strong ${prefix}PASSWORD before seeding.`);
    }
    if (pin && !/^\d{6}$/.test(pin)) throw new Error(`${prefix}PIN must contain exactly six digits.`);
    if (!owner && (email === 'admin@elicoffee.com' || userId === 'ELI001')) throw new Error('The staff seed cannot use the owner identity.');
    return { name, email, userId, password, ...(pin ? { pin } : {}), role: owner ? 'owner' : 'staff', mustChangePassword: true };
}

async function seedAccount(env, owner = false) {
    const account = seedConfiguration(env, owner);
    await mongoose.connect(env.MONGO_URI);
    try {
        const duplicates = [{ email: account.email }, { userId: account.userId }, ...(owner ? [{ role: 'owner' }] : [])];
        if (await User.exists({ $or: duplicates })) {
            console.log('An existing account already matches this seed. No account was changed.');
            return;
        }
        await User.create(account);
        console.log('Account created. Its temporary password must be replaced at first sign-in.');
    } finally { await mongoose.disconnect(); }
}
module.exports = { seedConfiguration, seedAccount };
