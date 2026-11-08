const LoginActivity = require('../models/LoginActivity');
const SystemAudit = require('../models/SystemAudit');
const { getShiftLoginAccess, SHIFT_TIME_ZONE } = require('../utils/shiftSchedule');

async function blockOffShiftLogin(req, res, user) {
    const attemptedAt = new Date();
    const access = getShiftLoginAccess(user, attemptedAt);
    if (access.allowed) return false;
    const invalid = access.reason === 'invalid_schedule';
    const next = access.nextAllowedAt ? new Intl.DateTimeFormat('en-PH', {
        timeZone: SHIFT_TIME_ZONE, weekday: 'short', year: 'numeric', month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit',
    }).format(access.nextAllowedAt) : '';
    const message = invalid
        ? 'Your shift restriction is enabled, but your schedule is incomplete or invalid. Please contact the owner or an authorized admin.'
        : `You cannot sign in outside your assigned shift.${next ? ` Next allowed sign-in: ${next} (Philippine time).` : ''} Please contact the owner or an authorized admin if your schedule needs updating.`;
    const ipAddress = String(req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || '').split(',')[0].trim();
    const details = invalid ? 'Login blocked because the restricted shift schedule is invalid.'
        : `Outside-shift login attempt blocked. Scheduled days: ${access.schedule.workdays.join(', ')}; ${access.schedule.startTime}–${access.schedule.endTime} Philippine time; early allowance: ${access.schedule.earlyLoginMinutes} minutes.`;
    await Promise.all([
        LoginActivity.create({
            userId: user._id, name: user.name || 'Unnamed User', email: user.email, role: user.role, staffId: user.userId || '',
            action: 'login_blocked_off_shift', blockedReason: access.reason, shiftSchedule: access.schedule,
            nextAllowedAt: access.nextAllowedAt || null, ipAddress, userAgent: req.headers['user-agent'] || '', createdAt: attemptedAt,
        }).catch(error => console.error('Failed to record outside-shift login attempt:', error.message)),
        SystemAudit.create({
            module: 'User Accounts', action: 'Outside-shift Login Blocked', entityId: String(user._id), entityName: user.name,
            actor: user.name || user.email, actorEmail: user.email, details,
            changes: { staffId: user.userId || '', attemptedAt, shiftSchedule: access.schedule, blockedReason: access.reason, nextAllowedAt: access.nextAllowedAt || null, ipAddress },
        }).catch(error => console.error('Failed to audit outside-shift login attempt:', error.message)),
    ]);
    res.status(403).json({ code: invalid ? 'SHIFT_SCHEDULE_INVALID' : 'OUTSIDE_SHIFT', message, nextAllowedAt: access.nextAllowedAt || null, timeZone: SHIFT_TIME_ZONE, attemptsRemaining: 3 });
    return true;
}

module.exports = { blockOffShiftLogin };
