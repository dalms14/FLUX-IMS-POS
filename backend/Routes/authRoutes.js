const express = require('express');
const router = express.Router();
const User = require('../models/User');
const LoginActivity = require('../models/LoginActivity');
const SystemAudit = require('../models/SystemAudit');
const bcrypt = require('bcryptjs');

const loginAttempts = new Map();
const MAX_ATTEMPTS = 3;
const LOCKOUT_DURATION = 30 * 1000;
const ALLOWED_ROLES = ['admin', 'staff'];
const ONLINE_TIMEOUT_MS = 2 * 60 * 1000;
const EMAIL_DOMAIN = '@elicoffee.com';

function normalizeEmail(email = '') {
    const value = String(email).toLowerCase().trim();
    if (!value) return '';
    return value.includes('@') ? value : `${value}${EMAIL_DOMAIN}`;
}

function normalizeRole(role = '') {
    return role.toLowerCase().trim();
}

async function generateUserId() {
    const count = await User.countDocuments({});
    let nextNumber = count + 1;
    let userId = `ELI${String(nextNumber).padStart(3, '0')}`;

    while (await User.exists({ userId })) {
        nextNumber += 1;
        userId = `ELI${String(nextNumber).padStart(3, '0')}`;
    }

    return userId;
}

function getAttemptRecord(email) {
    const key = normalizeEmail(email);
    const attempts = loginAttempts.get(key);

    if (attempts?.lockedUntil && Date.now() >= attempts.lockedUntil) {
        loginAttempts.delete(key);
        return { key, attempts: null };
    }

    return { key, attempts };
}

function getRemainingSeconds(attempts) {
    return Math.ceil((attempts.lockedUntil - Date.now()) / 1000);
}

function recordFailedAttempt(key) {
    const attempts = loginAttempts.get(key) || { count: 0, lockedUntil: null };
    attempts.count += 1;

    if (attempts.count >= MAX_ATTEMPTS) {
        attempts.lockedUntil = Date.now() + LOCKOUT_DURATION;
    }

    loginAttempts.set(key, attempts);
    return attempts;
}

function getClientIp(req) {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
        return String(forwardedFor).split(',')[0].trim();
    }

    return req.ip || req.socket?.remoteAddress || '';
}

function parseEndDate(value) {
    const end = new Date(value);
    if (!String(value).includes('T')) {
        end.setHours(23, 59, 59, 999);
    }
    return end;
}

function getOnlineCutoff() {
    return new Date(Date.now() - ONLINE_TIMEOUT_MS);
}

function serializeUser(user) {
    const lastSeenAt = user.lastSeenAt || user.updatedAt || null;
    const isOnline = Boolean(user.isOnline && lastSeenAt && new Date(lastSeenAt) >= getOnlineCutoff());

    return {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        userId: user.userId,
        profileImage: user.profileImage,
        isOnline,
        lastSeenAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
}

async function logAuthAudit({ action, user, details }) {
    try {
        await SystemAudit.create({
            module: 'User Accounts',
            action,
            entityId: user?._id || '',
            entityName: user?.name || '',
            actor: 'System',
            details,
            changes: {
                email: user?.email || '',
                role: user?.role || '',
                userId: user?.userId || '',
            },
        });
    } catch (err) {
        console.error('Auth audit error:', err.message);
    }
}

// Login Route
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const { key: attemptKey, attempts } = getAttemptRecord(email);

    if (!attemptKey || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }

    if (attempts?.lockedUntil) {
        const remainingSeconds = getRemainingSeconds(attempts);
        return res.status(423).json({
            message: `Too many failed attempts. Please try again in ${remainingSeconds} seconds.`,
            locked: true,
            remainingSeconds
        });
    }

    try {
        const user = await User.findOne({
            email: attemptKey
        });

        if (!user) {
            const updatedAttempts = recordFailedAttempt(attemptKey);

            if (updatedAttempts.lockedUntil) {
                const remainingSeconds = getRemainingSeconds(updatedAttempts);
                return res.status(423).json({
                    message: `Too many failed attempts. Please try again in ${remainingSeconds} seconds.`,
                    locked: true,
                    remainingSeconds
                });
            }

            return res.status(401).json({
                message: "Invalid credentials",
                attemptsRemaining: MAX_ATTEMPTS - updatedAttempts.count
            });
        }

        // Compare hashed password
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            const updatedAttempts = recordFailedAttempt(attemptKey);

            if (updatedAttempts.lockedUntil) {
                const remainingSeconds = getRemainingSeconds(updatedAttempts);
                return res.status(423).json({
                    message: `Too many failed attempts. Please try again in ${remainingSeconds} seconds.`,
                    locked: true,
                    remainingSeconds
                });
            }

            return res.status(401).json({
                message: "Invalid credentials",
                attemptsRemaining: MAX_ATTEMPTS - updatedAttempts.count
            });
        }

        loginAttempts.delete(attemptKey);

        user.isOnline = true;
        user.lastSeenAt = new Date();
        await user.save();

        await LoginActivity.create({
            userId: user._id,
            name: user.name || 'Unnamed User',
            email: user.email,
            role: user.role,
            action: 'login',
            staffId: user.userId || '',
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || '',
        });

        res.json({
            name: user.name,
            email: user.email,
            role: user.role,
            userId: user.userId,
            profileImage: user.profileImage,
            isOnline: true,
            lastSeenAt: user.lastSeenAt,
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

router.get('/login-activity', async (req, res) => {
    try {
        const { role, email, userId, startDate, endDate } = req.query;
        const filter = {};
        const normalizedRole = normalizeRole(role);

        if (ALLOWED_ROLES.includes(normalizedRole)) {
            filter.role = normalizedRole;
        }

        if (email) {
            filter.email = normalizeEmail(email);
        }

        if (userId) {
            filter.staffId = String(userId).trim().toUpperCase();
        }

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = parseEndDate(endDate);
        }

        const logs = await LoginActivity.find(filter)
            .sort({ createdAt: -1 })
            .limit(500)
            .lean();

        res.json({ success: true, count: logs.length, data: logs });
    } catch (err) {
        console.error('Error fetching login activity:', err);
        res.status(500).json({ message: 'Failed to fetch login activity' });
    }
});

router.get('/lockout-status', (req, res) => {
    const { email } = req.query;

    if (!email) {
        return res.json({ locked: false, attemptsRemaining: MAX_ATTEMPTS });
    }

    const { attempts } = getAttemptRecord(email);

    if (attempts?.lockedUntil) {
        const remainingSeconds = getRemainingSeconds(attempts);
        return res.json({
            locked: true,
            remainingSeconds,
            attemptsRemaining: 0
        });
    }

    return res.json({
        locked: false,
        attemptsRemaining: Math.max(0, MAX_ATTEMPTS - (attempts?.count || 0))
    });
});

router.post('/heartbeat', async (req, res) => {
    const normalizedEmail = normalizeEmail(req.body.email);

    if (!normalizedEmail) {
        return res.status(400).json({ message: 'Email is required' });
    }

    try {
        const user = await User.findOneAndUpdate(
            { email: normalizedEmail },
            { isOnline: true, lastSeenAt: new Date() },
            { returnDocument: 'after' }
        );

        if (!user) {
            return res.status(404).json({ message: 'User account not found' });
        }

        res.json({ success: true, user: serializeUser(user) });
    } catch (err) {
        console.error('Error updating online status:', err);
        res.status(500).json({ message: 'Failed to update online status' });
    }
});

router.post('/logout', async (req, res) => {
    const normalizedEmail = normalizeEmail(req.body.email);

    if (!normalizedEmail) {
        return res.status(400).json({ message: 'Email is required' });
    }

    try {
        const user = await User.findOneAndUpdate(
            { email: normalizedEmail },
            { isOnline: false, lastSeenAt: new Date() },
            { returnDocument: 'after' }
        );

        if (!user) {
            return res.status(404).json({ message: 'User account not found' });
        }

        await LoginActivity.create({
            userId: user._id,
            name: user.name || 'Unnamed User',
            email: user.email,
            role: user.role,
            action: 'logout',
            staffId: user.userId || '',
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || '',
        });

        res.json({ success: true, user: serializeUser(user) });
    } catch (err) {
        console.error('Error logging out user:', err);
        res.status(500).json({ message: 'Failed to log out user' });
    }
});

router.get('/users', async (req, res) => {
    const role = normalizeRole(req.query.role);
    const query = ALLOWED_ROLES.includes(role) ? { role } : {};

    try {
        const users = await User.find(query)
            .select('name email role userId profileImage isOnline lastSeenAt createdAt updatedAt')
            .sort({ role: 1, name: 1 })
            .lean();

        res.json({ success: true, data: users.map(serializeUser) });
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ message: 'Failed to fetch users' });
    }
});

router.post('/users', async (req, res) => {
    const { name, email, password, role, userId, pin } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const normalizedRole = normalizeRole(role);
    const normalizedUserId = String(userId || '').trim().toUpperCase();

    if (!name?.trim() || !normalizedEmail || !password || !normalizedRole) {
        return res.status(400).json({ message: 'Name, email, password, and role are required' });
    }

    if (!ALLOWED_ROLES.includes(normalizedRole)) {
        return res.status(400).json({ message: 'Role must be admin or staff' });
    }

    if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    if (pin && !/^\d{6}$/.test(String(pin))) {
        return res.status(400).json({ message: 'PIN must be exactly 6 digits' });
    }

    try {
        const existingEmail = await User.findOne({ email: normalizedEmail });
        if (existingEmail) {
            return res.status(409).json({ message: 'A user with that email already exists' });
        }

        const finalUserId = normalizedUserId || await generateUserId();
        const existingUserId = await User.findOne({ userId: finalUserId });
        if (existingUserId) {
            return res.status(409).json({ message: 'A user with that user ID already exists' });
        }

        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password,
            role: normalizedRole,
            userId: finalUserId,
            pin: pin ? String(pin).trim() : undefined,
        });

        await logAuthAudit({
            action: 'Created',
            user,
            details: `${user.role} account created`,
        });

        res.status(201).json({
            success: true,
            user: {
                name: user.name,
                email: user.email,
                role: user.role,
                userId: user.userId,
            },
        });
    } catch (err) {
        console.error('Error creating user:', err);
        if (err.code === 11000) {
            return res.status(409).json({ message: 'Email or user ID already exists' });
        }
        res.status(500).json({ message: 'Failed to create user' });
    }
});

router.delete('/users/:id', async (req, res) => {
    try {
        const { currentUserEmail, password } = req.body || {};
        const adminEmail = normalizeEmail(currentUserEmail);

        if (!adminEmail || !password) {
            return res.status(400).json({ message: 'Admin email and password confirmation are required' });
        }

        const adminUser = await User.findOne({ email: adminEmail });
        if (!adminUser || normalizeRole(adminUser.role) !== 'admin') {
            return res.status(403).json({ message: 'Only admin users can delete staff accounts' });
        }

        const passwordMatches = await bcrypt.compare(password, adminUser.password);
        if (!passwordMatches) {
            return res.status(401).json({ message: 'Password confirmation is incorrect' });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User account not found' });
        }

        if (normalizeRole(user.role) === 'admin') {
            const adminCount = await User.countDocuments({ role: 'admin' });
            if (adminCount <= 1) {
                return res.status(400).json({ message: 'Cannot delete the last admin account' });
            }
        }

        await User.findByIdAndDelete(user._id);

        await logAuthAudit({
            action: 'Deleted',
            user,
            details: `${user.role} account deleted`,
        });

        res.json({
            success: true,
            message: `${user.name || 'User'} has been deleted`,
            deletedUser: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                userId: user.userId,
            },
        });
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({ message: 'Failed to delete user account' });
    }
});

router.post('/change-password', async (req, res) => {
    const { email, currentPassword, newPassword } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    try {
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(404).json({ message: 'User account not found' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            return res.status(400).json({ message: 'New password must be different from the current password' });
        }

        user.password = newPassword;
        await user.save();

        res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
        console.error('Error changing password:', err);
        res.status(500).json({ message: 'Failed to change password' });
    }
});

router.post('/recover-password', async (req, res) => {
    const { email, currentPassword, newPassword } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Email, current password, and new password are required' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    try {
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(404).json({ message: 'User account not found' });
        }

        const passwordMatches = await bcrypt.compare(currentPassword, user.password);
        if (!passwordMatches) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            return res.status(400).json({ message: 'New password must be different from the current password' });
        }

        user.password = newPassword;
        await user.save();

        res.json({ success: true, message: 'Password recovered successfully' });
    } catch (err) {
        console.error('Error recovering password:', err);
        res.status(500).json({ message: 'Failed to recover password' });
    }
});

router.post('/reset-password', async (req, res) => {
    const { email, userId, newPassword } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const normalizedUserId = String(userId || '').trim().toUpperCase();

    if (!normalizedEmail || !normalizedUserId || !newPassword) {
        return res.status(400).json({ message: 'Email, user ID, and new password are required' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    try {
        const user = await User.findOne({ email: normalizedEmail, userId: normalizedUserId });
        if (!user) {
            return res.status(404).json({ message: 'Account verification failed' });
        }

        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            return res.status(400).json({ message: 'New password must be different from the current password' });
        }

        user.password = newPassword;
        await user.save();

        res.json({ success: true, message: 'Password reset successfully' });
    } catch (err) {
        console.error('Error resetting password:', err);
        res.status(500).json({ message: 'Failed to reset password' });
    }
});

router.put('/profile-picture', async (req, res) => {
    const { email, profileImage } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
        return res.status(400).json({ message: 'Email is required' });
    }

    try {
        const user = await User.findOneAndUpdate(
            { email: normalizedEmail },
            { profileImage: profileImage || '' },
            { returnDocument: 'after' }
        );

        if (!user) {
            return res.status(404).json({ message: 'User account not found' });
        }

        res.json({
            success: true,
            user: {
                name: user.name,
                email: user.email,
                role: user.role,
                userId: user.userId,
                profileImage: user.profileImage,
            },
        });
    } catch (err) {
        console.error('Error updating profile picture:', err);
        res.status(500).json({ message: 'Failed to update profile picture' });
    }
});

router.delete('/profile-picture', async (req, res) => {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
        return res.status(400).json({ message: 'Email is required' });
    }

    try {
        const user = await User.findOneAndUpdate(
            { email: normalizedEmail },
            { profileImage: '' },
            { returnDocument: 'after' }
        );

        if (!user) {
            return res.status(404).json({ message: 'User account not found' });
        }

        res.json({
            success: true,
            user: {
                name: user.name,
                email: user.email,
                role: user.role,
                userId: user.userId,
                profileImage: user.profileImage,
            },
        });
    } catch (err) {
        console.error('Error removing profile picture:', err);
        res.status(500).json({ message: 'Failed to remove profile picture' });
    }
});


// Forgot Password Verification
router.post('/verify-identity', async (req, res) => {
    const { email, userId } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const normalizedUserId = String(userId || '').trim().toUpperCase();

    try {
        const user = await User.findOne({
            email: normalizedEmail,
            userId: normalizedUserId
        });

        if (!user) {
            return res.json({ verified: false });
        }

        res.json({ verified: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ verified: false });
    }
});


module.exports = router;
