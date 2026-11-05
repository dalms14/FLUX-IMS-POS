const mongoose = require('mongoose');
const schema = new mongoose.Schema({ key: { type: String, required: true, unique: true }, count: Number, expiresAt: Date }, { collection: 'security_attempts' });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('SecurityAttempt', schema);
