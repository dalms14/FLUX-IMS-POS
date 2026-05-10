const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    role: String,
    pin: String,
    profileImage: String,
    isOnline: {
        type: Boolean,
        default: false
    },
    lastSeenAt: Date,
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
