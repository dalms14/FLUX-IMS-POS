const SecurityAttempt = require('../models/SecurityAttempt');
const { digest } = require('../services/authSessions');

async function reserve(key, limit, windowMs) {
    const now = new Date();
    const alive = { $gt: ['$expiresAt', now] };
    const update = [{ $set: {
        count: { $cond: [alive, { $add: [{ $ifNull: ['$count', 0] }, 1] }, 1] },
        expiresAt: { $cond: [alive, '$expiresAt', new Date(now.getTime() + windowMs)] },
    } }];
    const query = { key: digest(key) };
    let result;
    try { result = await SecurityAttempt.findOneAndUpdate(query, update, { upsert: true, returnDocument: 'after', updatePipeline: true }); }
    catch (err) {
        if (err.code !== 11000) throw err;
        result = await SecurityAttempt.findOneAndUpdate(query, update, { returnDocument: 'after', updatePipeline: true });
    }
    return Boolean(result && result.count <= limit);
}

async function credentialRateLimit(req, res, next) {
    const path = req.path.toLowerCase().replace(/\/+$/, '');
    const credential = req.method === 'POST' && ['/auth/login', '/auth/change-password', '/auth/recover-password', '/system/backup', '/auth/first-login-password'].includes(path)
        || req.method === 'DELETE' && /^\/auth\/users\/[^/]+$/.test(path)
        || req.method === 'POST' && /^\/auth\/users\/[^/]+\/restore$/.test(path);
    const otp = req.method === 'POST' && ['/auth/password-reset/request', '/auth/password-reset/confirm', '/auth/users/verification/request'].includes(path);
    if (!credential && !otp) return next();
    let account = String(req.user?.email || req.body?.email || req.body?.token || '').trim().toLowerCase();
    if (account && !account.includes('@') && !account.match(/^[a-f0-9]{64}$/)) account += '@elicoffee.com';
    try {
        const ip = req.ip || req.socket?.remoteAddress || 'unknown';
        const ipAllowed = await reserve(`verifier-ip:${ip}`, 60, 60000);
        if (!ipAllowed) return res.status(429).json({ message: 'Too many verification attempts. Please wait one minute and try again.' });
        const accountAllowed = await reserve(`verifier-account:${account || ip}`, 10, 60000);
        if (!accountAllowed) return res.status(429).json({ message: 'Too many verification attempts. Please wait one minute and try again.' });
        return next();
    } catch (err) {
        console.error('Verification limit failed:', err.message);
        return res.status(503).json({ message: 'Unable to verify this request. Please try again.' });
    }
}
module.exports = { credentialRateLimit, reserve };
