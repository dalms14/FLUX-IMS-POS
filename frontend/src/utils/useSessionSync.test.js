import { act, renderHook } from '@testing-library/react';
import useSessionSync from './useSessionSync';
import { clearSession, getSessionUser, SESSION_DURATION_MS, startSession } from './session';

const user = { email: 'staff@example.com', role: 'staff' };
const observe = () => { useSessionSync(); return getSessionUser(); };
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-22T00:00:00Z'));
});
afterEach(() => jest.useRealTimers());

test('two tab observers do not erase a partially published legacy login', () => {
  const firstTab = renderHook(observe);
  const secondTab = renderHook(observe);
  act(() => {
    localStorage.setItem('sessionExpiresAt', String(Date.now() + SESSION_DURATION_MS));
    window.dispatchEvent(new StorageEvent('storage', { key: 'sessionExpiresAt' }));
  });
  expect(localStorage.getItem('sessionExpiresAt')).not.toBeNull();
  act(() => {
    localStorage.setItem('user', JSON.stringify(user));
    window.dispatchEvent(new StorageEvent('storage', { key: 'user' }));
  });
  expect(firstTab.result.current).toEqual(user);
  expect(secondTab.result.current).toEqual(user);
});

test('both observers receive login and logout without reloading the browser', () => {
  const firstTab = renderHook(observe);
  const secondTab = renderHook(observe);
  act(() => startSession(user));
  expect(firstTab.result.current).toEqual(user);
  expect(secondTab.result.current).toEqual(user);
  act(() => clearSession());
  expect(firstTab.result.current).toBeNull();
  expect(secondTab.result.current).toBeNull();
});

test('an expired login stops being active in both observers after 24 hours', () => {
  startSession(user);
  const firstTab = renderHook(observe);
  const secondTab = renderHook(observe);
  act(() => jest.advanceTimersByTime(SESSION_DURATION_MS));
  expect(firstTab.result.current).toBeNull();
  expect(secondTab.result.current).toBeNull();
});
