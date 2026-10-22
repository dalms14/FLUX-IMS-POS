export const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const EXPIRY_KEY = 'sessionExpiresAt';
export const SESSION_CHANGED_EVENT = 'flux-session-changed';

export const clearSession = () => {
  localStorage.removeItem('user');
  localStorage.removeItem(EXPIRY_KEY);
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
};

export const startSession = (user) => {
  localStorage.setItem(EXPIRY_KEY, String(Date.now() + SESSION_DURATION_MS));
  localStorage.setItem('user', JSON.stringify(user));
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
};

export const getSessionUser = () => {
  try {
    const expiresAt = Number(localStorage.getItem(EXPIRY_KEY));
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    // Older saved logins have no reliable sign-in time; require a fresh login.
    if (!user?.email || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
    return user;
  } catch {
    return null;
  }
};
