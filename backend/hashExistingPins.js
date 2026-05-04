require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function hashExistingPins() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const users = await User.find({ pin: { $exists: true, $ne: '' } });
    let updated = 0;

    for (const user of users) {
        if (String(user.pin).startsWith('$2')) continue;

        user.markModified('pin');
        await user.save();
        updated += 1;
        console.log(`Hashed PIN for ${user.email}`);
    }

    console.log(`Done. Hashed ${updated} PIN${updated === 1 ? '' : 's'}.`);
    await mongoose.disconnect();
}

hashExistingPins().catch(async err => {
    console.error('Failed to hash PINs:', err.message);
    await mongoose.disconnect();
    process.exit(1);
});
