const mongoose = require('mongoose');

const EmailVerificationSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        index: true,
        lowercase: true,
        trim: true,
    },
    otpHash: {
        type: String,
        required: true,
        select: false,
    },
    expiresAt: {
        type: Date,
        required: true,
        expires: 0,
    },
    attempts: {
        type: Number,
        default: 0,
    },
}, {
    collection: 'email_verifications',
    timestamps: true,
});

module.exports = mongoose.model('EmailVerification', EmailVerificationSchema);

