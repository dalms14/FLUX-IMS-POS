const crypto = require('crypto');
const AuthSession = require('../models/AuthSession');
const User = require('../models/User');
const LoginActivity = require('../models/LoginActivity');
const SystemAudit = require('../models/SystemAudit');
const { getShiftSessionAccess } = require('../utils/shiftSchedule');
const IDLE_MS = 15 * 60 * 1000;
const digest = value => crypto.createHash('sha256').update(String(value)).digest('hex');

async function issueSession(user) {
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    await AuthSession.create({ tokenHash: digest(token), userId: user._id, credentialHash: digest(user.password), lastActivityAt: now, expiresAt: new Date(now.getTime() + IDLE_MS) });
    return token;
}

async function authenticate(req, res, next) {
    const header = req.headers?.authorization;
    const token = typeof header === 'string' && /^Bearer [a-f0-9]{64}$/.test(header) ? header.slice(7) : null;
    if (!token) return res.status(401).json({ code: 'AUTH_REQUIRED', message: 'Please sign in to continue.' });
    try {
        const now = new Date();
        const session = await AuthSession.findOne({ tokenHash: digest(token), expiresAt: { $gt: now } });
        if (!session) return res.status(401).json({ code: 'SESSION_EXPIRED', message: 'Your session has ended. Please sign in again.' });
        const user = await User.findById(session.userId);
        if (!user || user.archived || user.mustChangePassword || digest(user.password) !== session.credentialHash) {
            await AuthSession.deleteOne({ _id: session._id });
            return res.status(403).json({ code: 'ACCOUNT_INACTIVE', message: 'This account is no longer active. Please sign in with an active account.' });
        }
        const shiftAccess = getShiftSessionAccess(user, now);
        if (!shiftAccess.allowed) {
            await AuthSession.deleteOne({ _id: session._id });
            user.isOnline = false;
            await user.save();
            await Promise.all([
                LoginActivity.create({ userId: user._id, name: user.name || 'Unnamed User', email: user.email,
                    role: user.role, staffId: user.userId || '', action: 'logout', blockedReason: shiftAccess.reason,
                    shiftSchedule: shiftAccess.schedule, userAgent: req.headers['user-agent'] || '',
                }).catch(error => console.error('Failed to record shift sign-out:', error.message)),
                SystemAudit.create({ module: 'User Accounts', action: 'Shift Session Ended', entityId: String(user._id),
                    entityName: user.name, actor: 'System', actorEmail: user.email,
                    details: 'Automatically signed out because the assigned shift and its 5-minute wrap-up allowance ended, or the restricted schedule is no longer valid.',
                }).catch(error => console.error('Failed to audit shift sign-out:', error.message)),
            ]);
            return res.status(403).json({ code: 'SHIFT_SESSION_ENDED', message: 'Your shift has ended. You have been signed out automatically.' });
        }
        // Polling/heartbeats do not count as user activity. The browser shares its
        // last input timestamp across tabs; an expired session can never be revived.
        const activity = Number(req.headers['x-session-activity']);
        if (Number.isFinite(activity) && activity > new Date(session.lastActivityAt).getTime() && activity <= now.getTime() + 30000 && activity >= now.getTime() - 60000) {
            const lastActivityAt = new Date(Math.min(activity, now.getTime()));
            const renewed = await AuthSession.updateOne({ _id: session._id, expiresAt: { $gt: now } }, { $max: { lastActivityAt, expiresAt: new Date(lastActivityAt.getTime() + IDLE_MS) } });
            if (!renewed.matchedCount) return res.status(401).json({ code: 'SESSION_EXPIRED', message: 'Please sign in again.' });
        }
        req.user = user;
        req.authSession = session;
        return next();
    } catch (err) {
        console.error('Session check failed:', err.message);
        return res.status(503).json({ message: 'Unable to verify your session. Please try again.' });
    }
}

module.exports = { issueSession, authenticate, digest, IDLE_MS };
