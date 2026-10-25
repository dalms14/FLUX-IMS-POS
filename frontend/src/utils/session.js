export const SESSION_DURATION_MS = 15 * 60 * 1000;
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
  const now = Date.now();
  localStorage.setItem('user', JSON.stringify({ ...user, _session: { id, version: 2, lastActiveAt: now, expiresAt: now + SESSION_DURATION_MS } }));
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
};

const readSession = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    // Old sessions have no activity timestamp: require a fresh login under the idle policy.
    const { expiresAt, lastActiveAt, version } = user?._session || {};
    if (!user?.email || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
    if (version !== 2 || !Number.isFinite(lastActiveAt) || lastActiveAt > Date.now()
      || expiresAt !== lastActiveAt + SESSION_DURATION_MS) return null;
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

export const recordSessionActivity = () => {
  const session = readSession();
  // An input event after expiry must not revive the session.
  if (!session) return false;
  const now = Date.now();
  if (session.user._session.lastActiveAt === now) return true;
  localStorage.setItem('user', JSON.stringify({ ...session.user, _session: {
    ...session.user._session, lastActiveAt: now, expiresAt: now + SESSION_DURATION_MS,
  } }));
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
  return true;
};

export const clearSessionIfCurrent = id => {
  if (!id || getSessionId() !== id) return false;
  clearSession();
  return true;
};
