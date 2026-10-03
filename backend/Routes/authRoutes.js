const express = require('express');
const router = express.Router();
const User = require('../models/User');
const LoginActivity = require('../models/LoginActivity');
const SystemAudit = require('../models/SystemAudit');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const loginAttempts = new Map();
const MAX_ATTEMPTS = 3;
const LOCKOUT_DURATION = 30 * 1000;
const ALLOWED_ROLES = ['owner', 'admin', 'custom', 'staff'];
const VALID_PERMISSIONS = new Set([
    'dashboard',
    'items',
    'products',
    'sales',
    'inventory',
    'purchase_orders',
    'transactions',
    'staff',
    'history',
    'reports',
    'settings',
    'users',
]);
const ONLINE_TIMEOUT_MS = 2 * 60 * 1000;
const EMAIL_DOMAIN = '@elicoffee.com';
const OTP_LIFETIME_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

function normalizeEmail(email = '') {
    const value = String(email).toLowerCase().trim();
    if (!value) return '';
    return value.includes('@') ? value : `${value}${EMAIL_DOMAIN}`;
}

function normalizeRole(role = '') {
    return role.toLowerCase().trim();
}

function isOwnerAccount(user) {
    return normalizeRole(user?.role) === 'owner' ||
        String(user?.userId || '').trim().toUpperCase() === 'ELI001' ||
        normalizeEmail(user?.email) === 'admin@elicoffee.com';
}

function normalizePermissions(permissions = []) {
    if (!Array.isArray(permissions)) return [];
    return [...new Set(
        permissions
            .map(permission => String(permission || '').trim())
            .filter(permission => VALID_PERMISSIONS.has(permission))
    )];
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
        jobRole: user.jobRole,
        permissions: user.permissions,
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
                jobRole: user?.jobRole || '',
                permissions: Array.isArray(user?.permissions) ? user.permissions : [],
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
            jobRole: user.jobRole,
            permissions: user.permissions,
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
            { email: normalizedEmail, archived: { $ne: true } },
            { isOnline: true, lastSeenAt: new Date() },
            { returnDocument: 'after' }
        );

        if (!user) {
            return res.status(403).json({ message: 'This account is no longer active. Please sign in with an active account.' });
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
    const showArchived = req.query.archived === 'true';
    const query = {
        ...(ALLOWED_ROLES.includes(role) ? { role } : {}),
        ...(showArchived ? { archived: true } : { archived: { $ne: true } }),
    };

    try {
        const users = await User.find(query)
            .select('name email role jobRole permissions userId profileImage isOnline lastSeenAt archived archivedAt createdAt updatedAt')
            .sort({ role: 1, name: 1 })
            .lean();

        res.json({ success: true, data: users.map(serializeUser) });
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ message: 'Failed to fetch users' });
    }
});

router.post('/users', async (req, res) => {
    const { name, email, password, role, jobRole, userId, pin, permissions } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const normalizedRole = normalizeRole(role);
    const normalizedUserId = String(userId || '').trim().toUpperCase();
    const normalizedJobRole = String(jobRole || '').trim().toLowerCase();

    if (!name?.trim() || !normalizedEmail || !password || !normalizedRole) {
        return res.status(400).json({ message: 'Name, email, password, and role are required' });
    }

    if (!ALLOWED_ROLES.includes(normalizedRole)) {
        return res.status(400).json({ message: 'Role must be custom or staff' });
    }

    if (normalizedRole === 'custom' && !['finance', 'operations', 'hr'].includes(normalizedJobRole)) {
        return res.status(400).json({ message: 'Custom role must be Finance, Operations, or HR' });
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
            if (existingEmail.archived) {
                return res.status(409).json({ message: 'This email belongs to an archived account. Restore the account from Users instead of creating a duplicate.' });
            }
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
            jobRole: normalizedRole === 'custom' ? normalizedJobRole : undefined,
            permissions: ['admin', 'custom'].includes(normalizedRole) ? normalizePermissions(permissions) : undefined,
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
                jobRole: user.jobRole,
                permissions: user.permissions,
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

router.put('/users/:id/access', async (req, res) => {
    try {
        const ownerEmail = normalizeEmail(req.body.currentUserEmail);
        const ownerUserId = String(req.body.currentUserId || '').trim().toUpperCase();

        if (!ownerEmail && !ownerUserId) {
            return res.status(400).json({ message: 'Owner account is required' });
        }

        const ownerUser = await User.findOne({
            $or: [
                ...(ownerEmail ? [{ email: ownerEmail }] : []),
                ...(ownerUserId ? [{ userId: ownerUserId }] : []),
            ],
        });
        if (!ownerUser || !isOwnerAccount(ownerUser)) {
            return res.status(403).json({ message: 'Only the owner can edit user access' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User account not found' });
        }

        if (isOwnerAccount(user)) {
            return res.status(400).json({ message: 'Owner access cannot be changed' });
        }

        user.permissions = normalizePermissions(req.body.permissions);
        await user.save();

        await logAuthAudit({
            action: 'Updated Access',
            user,
            details: `${user.role} account access updated`,
        });

        res.json({
            success: true,
            user: serializeUser(user),
        });
    } catch (err) {
        console.error('Error updating user access:', err);
        res.status(500).json({ message: 'Failed to update user access' });
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
        const adminRole = normalizeRole(adminUser?.role);
        const canDeleteUsers = adminRole === 'owner' || (
            adminRole === 'admin' &&
            Array.isArray(adminUser.permissions) &&
            adminUser.permissions.includes('users')
        ) || (
            adminRole === 'admin' &&
            !Array.isArray(adminUser.permissions)
        );

        if (!adminUser || !canDeleteUsers) {
            return res.status(403).json({ message: 'Only authorized users can delete accounts' });
        }

        const passwordMatches = await bcrypt.compare(password, adminUser.password);
        if (!passwordMatches) {
            return res.status(401).json({ message: 'Password confirmation is incorrect' });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User account not found' });
        }

        if (String(user._id) === String(adminUser._id)) {
            return res.status(400).json({ message: 'You cannot delete your own account' });
        }

        if (isOwnerAccount(user)) {
            return res.status(400).json({ message: 'Owner account cannot be deleted' });
        }

        if (normalizeRole(user.role) === 'admin') {
            const adminCount = await User.countDocuments({ role: 'admin' });
            if (adminCount <= 1) {
                return res.status(400).json({ message: 'Cannot delete the last admin account' });
            }
        }

        user.archived = true;
        user.archivedAt = new Date();
        user.isOnline = false;
        await user.save();

        await logAuthAudit({
            action: 'Archived',
            user,
            details: `${user.role} account archived`,
        });

        res.json({
            success: true,
            message: `${user.name || 'User'} has been archived`,
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

router.post('/users/:id/restore', async (req, res) => {
    try {
        const { currentUserEmail, password } = req.body || {};
        const adminUser = await User.findOne({ email: normalizeEmail(currentUserEmail), archived: { $ne: true } });
        if (!adminUser || !(normalizeRole(adminUser.role) === 'owner' || (normalizeRole(adminUser.role) === 'admin' && (!Array.isArray(adminUser.permissions) || adminUser.permissions.includes('users'))))) {
            return res.status(403).json({ message: 'Only authorized users can restore accounts' });
        }
        if (!password || !(await bcrypt.compare(password, adminUser.password))) return res.status(401).json({ message: 'Password confirmation is incorrect' });
        const user = await User.findOneAndUpdate({ _id: req.params.id, archived: true }, { archived: false, archivedAt: null }, { returnDocument: 'after' });
        if (!user) return res.status(404).json({ message: 'Archived user account not found' });
        await logAuthAudit({ action: 'Restored', user, details: `${user.role} account restored` });
        res.json({ success: true, user: serializeUser(user) });
    } catch (err) {
        res.status(500).json({ message: 'Failed to restore user account' });
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
    res.status(410).json({ message: 'This reset method is no longer available. Request a verification code instead.' });
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
    res.status(410).json({ message: 'This verification method is no longer available. Request a verification code instead.' });
});

function hashOtp(otp) {
    return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

function createOtp() {
    return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function isStrongPassword(password = '') {
    return password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
}

async function sendResetOtpEmail(to, otp) {
    const apiKey = String(process.env.RESEND_API_KEY || '').trim();
    const from = String(process.env.RESEND_FROM || '').trim();
    if (!apiKey || !from) throw new Error('Email service is not configured');

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            from,
            to: [to],
            subject: 'Your FLUX password reset code',
            text: `Your FLUX password reset code is ${otp}. It expires in 10 minutes. Do not share this code with anyone.`,
        }),
    });
    if (!response.ok) throw new Error(`Email provider rejected the request (${response.status})`);
}

// Always return the same success message so callers cannot discover which emails have accounts.
router.post('/password-reset/request', async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const response = { success: true, message: 'If an active account uses that email, a verification code has been sent.' };
    if (!email) return res.status(400).json({ message: 'Enter your email address.' });

    try {
        const user = await User.findOne({ email, archived: { $ne: true } }).select('+passwordResetOtpExpiresAt');
        if (!user) return res.json(response);
        if (user.passwordResetOtpExpiresAt && user.passwordResetOtpExpiresAt.getTime() - Date.now() > OTP_LIFETIME_MS - OTP_RESEND_COOLDOWN_MS) {
            return res.status(429).json({ message: 'Please wait one minute before requesting another code.' });
        }

        const otp = createOtp();
        user.passwordResetOtpHash = hashOtp(otp);
        user.passwordResetOtpExpiresAt = new Date(Date.now() + OTP_LIFETIME_MS);
        user.passwordResetOtpAttempts = 0;
        user.passwordResetOtpUsedAt = null;
        await user.save();
        try {
            await sendResetOtpEmail(user.email, otp);
        } catch (emailError) {
            user.passwordResetOtpHash = null;
            user.passwordResetOtpExpiresAt = null;
            await user.save();
            console.error('Password reset email failed:', emailError.message);
            return res.status(503).json({ message: 'We could not send a code right now. Please try again later.' });
        }
        res.json(response);
    } catch (err) {
        console.error('Password reset request failed:', err);
        res.status(500).json({ message: 'Unable to process the reset request. Please try again.' });
    }
});

router.post('/password-reset/confirm', async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || '').replace(/\D/g, '');
    const newPassword = String(req.body.newPassword || '');
    if (!email || otp.length !== 6 || !newPassword) return res.status(400).json({ message: 'Email, six-digit code, and new password are required.' });
    if (!isStrongPassword(newPassword)) return res.status(400).json({ message: 'Use at least 8 characters with an uppercase letter, lowercase letter, and number.' });

    try {
        const user = await User.findOne({ email, archived: { $ne: true } }).select('+passwordResetOtpHash +passwordResetOtpExpiresAt +passwordResetOtpAttempts +passwordResetOtpUsedAt');
        if (!user || !user.passwordResetOtpHash || user.passwordResetOtpUsedAt || !user.passwordResetOtpExpiresAt || user.passwordResetOtpExpiresAt <= new Date()) {
            return res.status(400).json({ message: 'This code is invalid or has expired. Request a new code.' });
        }
        if (user.passwordResetOtpAttempts >= OTP_MAX_ATTEMPTS) {
            return res.status(429).json({ message: 'Too many incorrect attempts. Request a new code.' });
        }
        if (hashOtp(otp) !== user.passwordResetOtpHash) {
            user.passwordResetOtpAttempts += 1;
            await user.save();
            return res.status(400).json({ message: `Incorrect code. ${OTP_MAX_ATTEMPTS - user.passwordResetOtpAttempts} attempt(s) remaining.` });
        }
        if (await bcrypt.compare(newPassword, user.password)) return res.status(400).json({ message: 'Use a password different from your current password.' });

        user.password = newPassword;
        user.passwordResetOtpHash = null;
        user.passwordResetOtpExpiresAt = null;
        user.passwordResetOtpAttempts = 0;
        user.passwordResetOtpUsedAt = new Date();
        user.isOnline = false;
        await user.save();
        await SystemAudit.create({ module: 'Security', action: 'Password Reset', entityId: user._id, entityName: user.name, actor: user.name, actorEmail: user.email, details: 'Password reset with one-time email verification code' });
        res.json({ success: true, message: 'Password reset successfully. You can now sign in.' });
    } catch (err) {
        console.error('Password reset confirmation failed:', err);
        res.status(500).json({ message: 'Unable to reset the password. Please try again.' });
    }
});


module.exports = router;
