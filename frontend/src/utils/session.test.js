import { clearSession, getSessionUser, SESSION_DURATION_MS, startSession } from './session';

const user = { email: 'staff@example.com', role: 'staff', name: 'Staff' };

beforeEach(() => {
  localStorage.clear();
  jest.spyOn(Date, 'now').mockReturnValue(1000000);
});
afterEach(() => jest.restoreAllMocks());

test('restores a saved login until exactly 24 hours after sign-in', () => {
  startSession(user);
  Date.now.mockReturnValue(1000000 + SESSION_DURATION_MS - 1);
  expect(getSessionUser()).toEqual(user);
  Date.now.mockReturnValue(1000000 + SESSION_DURATION_MS);
  expect(getSessionUser()).toBeNull();
});

test('reading a session and updating a profile do not extend its lifetime', () => {
  startSession(user);
  const expiry = localStorage.getItem('sessionExpiresAt');
  Date.now.mockReturnValue(1000000 + 60000);
  localStorage.setItem('user', JSON.stringify({ ...user, name: 'Updated' }));
  expect(getSessionUser().name).toBe('Updated');
  expect(localStorage.getItem('sessionExpiresAt')).toBe(expiry);
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
