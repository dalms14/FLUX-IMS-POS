const mongoose = require('mongoose');

const LoginActivitySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String, required: true },
    action: { type: String, enum: ['login', 'logout', 'login_blocked_archived', 'login_blocked_off_shift'], default: 'login' },
    blockedReason: { type: String, enum: ['', 'off_shift', 'invalid_schedule'], default: '' },
    shiftSchedule: { type: new mongoose.Schema({
        workdays: [String], startTime: String, endTime: String, restrictLogin: Boolean, earlyLoginMinutes: Number, timeZone: String,
    }, { _id: false }), default: undefined },
    nextAllowedAt: { type: Date, default: null },
    staffId: { type: String, default: '' },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
}, {
    collection: 'login_activity',
    timestamps: true,
});

LoginActivitySchema.index({ createdAt: -1 });
LoginActivitySchema.index({ email: 1, createdAt: -1 });
LoginActivitySchema.index({ role: 1, createdAt: -1 });

module.exports = mongoose.model('LoginActivity', LoginActivitySchema);
