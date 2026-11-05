const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    credentialHash: { type: String, required: true },
    lastActivityAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
}, { timestamps: true, collection: 'auth_sessions' });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('AuthSession', schema);
