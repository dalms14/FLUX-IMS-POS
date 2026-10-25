import { clearSession, getSessionId, getSessionUser, SESSION_DURATION_MS, startSession, recordSessionActivity } from './session';

const user = { email: 'staff@example.com', role: 'staff', name: 'Staff' };

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  jest.spyOn(Date, 'now').mockReturnValue(1000000);
});
afterEach(() => jest.restoreAllMocks());

test('restores a saved login until exactly 15 minutes without activity', () => {
  startSession(user);
  Date.now.mockReturnValue(1000000 + SESSION_DURATION_MS - 1);
  expect(getSessionUser()).toEqual(user);
  Date.now.mockReturnValue(1000000 + SESSION_DURATION_MS);
  expect(getSessionUser()).toBeNull();
});

test('reading a session and updating a profile do not extend its lifetime', () => {
  startSession(user);
  const saved = JSON.parse(localStorage.getItem('user'));
  Date.now.mockReturnValue(1000000 + 60000);
  localStorage.setItem('user', JSON.stringify({ ...saved, name: 'Updated' }));
  expect(getSessionUser().name).toBe('Updated');
  expect(JSON.parse(localStorage.getItem('user'))._session).toEqual(saved._session);
});

test('logout clears both saved identity and expiry', () => {
  startSession(user);
  clearSession();
  expect(getSessionUser()).toBeNull();
  expect(localStorage.getItem('user')).toBeNull();
  expect(localStorage.getItem('sessionExpiresAt')).toBeNull();
});

test('rejects legacy, malformed, and missing saved logins', () => {
  expect(getSessionUser()).toBeNull();
  localStorage.setItem('user', JSON.stringify(user));
  expect(getSessionUser()).toBeNull();
  localStorage.setItem('sessionExpiresAt', 'invalid');
  expect(getSessionUser()).toBeNull();
  localStorage.setItem('sessionExpiresAt', String(1000000 + SESSION_DURATION_MS));
  localStorage.setItem('user', '{broken');
  expect(getSessionUser()).toBeNull();
});

test('publishes identity and expiry together so a second tab always sees a complete login', () => {
  const original = Storage.prototype.setItem;
  const observed = [];
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    original.call(this, key, value);
    if (this === localStorage) observed.push(getSessionUser());
  });
  startSession(user);
  expect(observed).toEqual([user]);
  expect(localStorage.getItem('sessionExpiresAt')).toBeNull();
});

test('old 24-hour sessions require a fresh login under the inactivity policy', () => {
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('sessionExpiresAt', String(1000000 + 86400000));
  expect(getSessionUser()).toBeNull();
  localStorage.setItem('user', JSON.stringify({ ...user, _session: { id: 'old', expiresAt: 1000000 + 86400000 } }));
  expect(getSessionUser()).toBeNull();
});

test('activity extends the idle deadline without changing the login identity', () => {
  startSession(user);
  const id = getSessionId();
  Date.now.mockReturnValue(1000000 + 10 * 60000);
  expect(recordSessionActivity()).toBe(true);
  expect(getSessionId()).toBe(id);
  Date.now.mockReturnValue(1000000 + 24 * 60000);
  expect(getSessionUser()).toEqual(user);
  Date.now.mockReturnValue(1000000 + 25 * 60000);
  expect(getSessionUser()).toBeNull();
  expect(recordSessionActivity()).toBe(false);
});

test('each login gets its own identity even for the same account', () => {
  startSession(user);
  const previous = getSessionId();
  startSession(user);
  expect(getSessionId()).not.toBe(previous);
});
