export const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const EXPIRY_KEY = 'sessionExpiresAt';
export const SESSION_CHANGED_EVENT = 'flux-session-changed';

export const clearSession = () => {
  sessionStorage.removeItem('firstLoginChallenge');
  localStorage.removeItem('user');
  localStorage.removeItem(EXPIRY_KEY);
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
};

export const startSession = (user) => {
  sessionStorage.removeItem('firstLoginChallenge');
  // One storage write publishes both identity and expiry to every tab together.
  const id = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem('user', JSON.stringify({ ...user, _session: { id, expiresAt: Date.now() + SESSION_DURATION_MS } }));
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
};

const readSession = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    // Preserve still-valid 24-hour sessions created by the previous app version.
    const expiresAt = user?._session ? user._session.expiresAt : Number(localStorage.getItem(EXPIRY_KEY));
    if (!user?.email || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
    if (user._session && (typeof user._session.id !== 'string' || !user._session.id)) return null;
    return { user, id: user._session?.id || `legacy:${user.email}:${expiresAt}` };
  } catch {
    return null;
  }
};

export const getSessionUser = () => {
  const session = readSession();
  if (!session) return null;
  const { _session, ...user } = session.user;
  return user;
};

export const getSessionId = () => readSession()?.id || null;

export const clearSessionIfCurrent = id => {
  if (!id || getSessionId() !== id) return false;
  clearSession();
  return true;
};
