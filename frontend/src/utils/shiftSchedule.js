import { isOwnerAccount, normalizeRole } from './roles';

export const isShiftExempt = user => isOwnerAccount(user) || normalizeRole(user?.role) === 'admin';
export const SHIFT_DAYS = [
  ['monday', 'Monday'], ['tuesday', 'Tuesday'], ['wednesday', 'Wednesday'], ['thursday', 'Thursday'],
  ['friday', 'Friday'], ['saturday', 'Saturday'], ['sunday', 'Sunday'],
];
export const defaultShiftSchedule = () => ({ workdays: [], startTime: '', endTime: '', restrictLogin: false, earlyLoginMinutes: 15, timeZone: 'Asia/Manila' });
const formatTime = time => {
  const [hour, minute] = time.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
};
export const shiftSummary = schedule => {
  if (!schedule?.workdays?.length || !schedule.startTime || !schedule.endTime) return 'No shift assigned';
  const days = SHIFT_DAYS.filter(([day]) => schedule.workdays.includes(day)).map(([, label]) => label.slice(0, 3)).join(', ');
  return `${days} · ${formatTime(schedule.startTime)}–${formatTime(schedule.endTime)}${schedule.endTime < schedule.startTime ? ' (+1 day)' : ''} · PHT`;
};
