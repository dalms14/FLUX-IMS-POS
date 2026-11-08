const SHIFT_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const SHIFT_TIME_ZONE = 'Asia/Manila';
const defaultShiftSchedule = () => ({ workdays: [], startTime: '', endTime: '', restrictLogin: false, earlyLoginMinutes: 15, timeZone: SHIFT_TIME_ZONE });

function validateShiftSchedule(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: 'Enter a valid shift schedule.' };
    const schedule = { ...defaultShiftSchedule(), ...value };
    if (!Array.isArray(schedule.workdays) || schedule.workdays.some(day => !SHIFT_DAYS.includes(day))) return { error: 'Choose valid workdays.' };
    if (typeof schedule.restrictLogin !== 'boolean') return { error: 'Choose whether login should be restricted to the shift.' };
    if (!Number.isInteger(schedule.earlyLoginMinutes) || schedule.earlyLoginMinutes < 0 || schedule.earlyLoginMinutes > 120) return { error: 'Early login allowance must be a whole number from 0 to 120 minutes.' };
    if (schedule.timeZone !== SHIFT_TIME_ZONE) return { error: 'Shift schedules must use Philippine time (Asia/Manila).' };
    const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    if (typeof schedule.startTime !== 'string' || typeof schedule.endTime !== 'string'
        || (schedule.startTime && !time.test(schedule.startTime)) || (schedule.endTime && !time.test(schedule.endTime))) return { error: 'Enter valid shift times in HH:MM format.' };
    const configured = schedule.workdays.length || schedule.startTime || schedule.endTime || schedule.restrictLogin;
    if (configured && (!schedule.workdays.length || !schedule.startTime || !schedule.endTime)) return { error: 'Select at least one workday and enter both shift times.' };
    if (configured && schedule.startTime === schedule.endTime) return { error: 'Shift start and end times must be different. An earlier end time means the following day.' };
    // Store only known settings, with workdays in calendar order.
    return { schedule: {
        workdays: SHIFT_DAYS.filter(day => schedule.workdays.includes(day)),
        startTime: schedule.startTime, endTime: schedule.endTime, restrictLogin: schedule.restrictLogin,
        earlyLoginMinutes: schedule.earlyLoginMinutes, timeZone: SHIFT_TIME_ZONE,
    } };
}

function getShiftLoginAccess(user, now = new Date()) {
    const { isOwner, role } = require('./permissions');
    if (isOwner(user) || role(user) === 'admin') return { allowed: true, exempt: true };
    const saved = user?.shiftSchedule?.toObject?.() || user?.shiftSchedule;
    if (!saved?.restrictLogin) return { allowed: true };
    const { schedule, error } = validateShiftSchedule(saved);
    if (error || !schedule.workdays.length) return { allowed: false, reason: 'invalid_schedule', schedule: saved };

    const parts = new Intl.DateTimeFormat('en-US', { timeZone: SHIFT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const part = name => Number(parts.find(value => value.type === name).value);
    const localDate = Date.UTC(part('year'), part('month') - 1, part('day'));
    const minutes = time => { const [hour, minute] = time.split(':').map(Number); return hour * 60 + minute; };
    const dayMs = 24 * 60 * 60 * 1000;
    const startMinutes = minutes(schedule.startTime), endMinutes = minutes(schedule.endTime);
    const weekday = ['sunday', ...SHIFT_DAYS.slice(0, 6)];
    let nextAllowedAt = null;
    // Include yesterday's overnight shift and tomorrow's early-access window.
    // Philippine time stays at UTC+08:00, independent of the server time zone.
    for (let offset = -1; offset <= 7; offset += 1) {
        const date = localDate + offset * dayMs;
        if (!schedule.workdays.includes(weekday[new Date(date).getUTCDay()])) continue;
        const shiftStart = date + (startMinutes - 8 * 60) * 60000;
        const opens = shiftStart - schedule.earlyLoginMinutes * 60000;
        const closes = date + (endMinutes - 8 * 60) * 60000 + (endMinutes < startMinutes ? dayMs : 0);
        if (now.getTime() >= opens && now.getTime() < closes) return { allowed: true, schedule };
        if (opens > now.getTime() && (!nextAllowedAt || opens < nextAllowedAt.getTime())) nextAllowedAt = new Date(opens);
    }
    return { allowed: false, reason: 'off_shift', schedule, nextAllowedAt };
}

module.exports = { SHIFT_DAYS, SHIFT_TIME_ZONE, defaultShiftSchedule, validateShiftSchedule, getShiftLoginAccess };
