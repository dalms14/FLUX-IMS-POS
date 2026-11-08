const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { SHIFT_DAYS, SHIFT_TIME_ZONE, defaultShiftSchedule, validateShiftSchedule } = require('../utils/shiftSchedule');

const ShiftScheduleSchema = new mongoose.Schema({
    workdays: { type: [{ type: String, enum: SHIFT_DAYS }], default: [] },
    startTime: { type: String, default: '' },
    endTime: { type: String, default: '' },
    restrictLogin: { type: Boolean, default: false },
    earlyLoginMinutes: { type: Number, default: 15, min: 0, max: 120 },
    timeZone: { type: String, enum: [SHIFT_TIME_ZONE], default: SHIFT_TIME_ZONE },
}, { _id: false });

const UserSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    mustChangePassword: { type: Boolean, default: false },
    firstLoginTokenHash: { type: String, default: null, select: false },
    firstLoginTokenExpiresAt: { type: Date, default: null, select: false },
    role: String,
    jobRole: String,
    shiftSchedule: {
        type: ShiftScheduleSchema,
        default: defaultShiftSchedule,
        validate: { validator: value => !validateShiftSchedule(value.toObject()).error, message: 'Enter a complete, valid shift schedule.' },
        required: true,
    },
    permissions: {
        type: [String],
        default: undefined,
    },
    pin: String,
    profileImage: String,
    isOnline: {
        type: Boolean,
        default: false
    },
    lastSeenAt: Date,
    archived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date, default: null },
    passwordResetOtpHash: { type: String, default: null, select: false },
    passwordResetOtpExpiresAt: { type: Date, default: null, select: false },
    passwordResetOtpAttempts: { type: Number, default: 0, select: false },
    passwordResetOtpUsedAt: { type: Date, default: null, select: false },
    userId: {
        type: String,
        required: true,
        unique: true
    }
}, {
    collection: 'users',
    timestamps: true
});

// Hash password before saving
UserSchema.pre('save', async function () {
    const hashTasks = [];

    if (this.isModified('password') && this.password) {
        hashTasks.push(
            bcrypt.hash(this.password, 10).then(hash => {
                this.password = hash;
            })
        );
    }

    if (this.isModified('pin') && this.pin && !String(this.pin).startsWith('$2')) {
        hashTasks.push(
            bcrypt.hash(String(this.pin), 10).then(hash => {
                this.pin = hash;
            })
        );
    }

    await Promise.all(hashTasks);
});

// Method to compare password on login
UserSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.comparePin = async function (candidatePin) {
    if (!this.pin) return false;

    if (String(this.pin).startsWith('$2')) {
        return bcrypt.compare(String(candidatePin), this.pin);
    }

    return String(candidatePin) === String(this.pin);
};

module.exports = mongoose.model('User', UserSchema);
