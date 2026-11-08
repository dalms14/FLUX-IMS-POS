import { shiftSummary } from './shiftSchedule';

export const isBlockedLogin = action => ['login_blocked_archived', 'login_blocked_off_shift'].includes(action);
export const loginActivityLabel = action => {
  if (action === 'login_blocked_off_shift') return 'Blocked — Outside shift';
  if (action === 'login_blocked_archived') return 'Blocked — Archived account';
  return action === 'logout' ? 'Signed out' : 'Signed in';
};
export const loginActivityDetails = row => {
  if (row.action !== 'login_blocked_off_shift') return '';
  if (row.blockedReason === 'invalid_schedule') return 'Restricted shift schedule is incomplete or invalid. Contact an authorized admin.';
  const next = row.nextAllowedAt ? new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit',
  }).format(new Date(row.nextAllowedAt)) : '';
  return `${shiftSummary(row.shiftSchedule)}; Early login allowance: ${row.shiftSchedule?.earlyLoginMinutes ?? 0} minutes${next ? `; Next allowed sign-in: ${next} PHT` : ''}`;
};
