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

test('an expired login stops being active in both observers after 15 minutes of inactivity', () => {
  startSession(user);
  const firstTab = renderHook(observe);
  const secondTab = renderHook(observe);
  act(() => jest.advanceTimersByTime(SESSION_DURATION_MS));
  expect(firstTab.result.current).toBeNull();
  expect(secondTab.result.current).toBeNull();
});

test('input keeps both tab observers active until 15 minutes after the last interaction', () => {
  startSession(user);
  const first = renderHook(observe);
  const second = renderHook(observe);
  act(() => jest.advanceTimersByTime(10 * 60000));
  act(() => window.dispatchEvent(new Event('keydown')));
  act(() => jest.advanceTimersByTime(10 * 60000));
  expect(first.result.current).toEqual(user);
  expect(second.result.current).toEqual(user);
  act(() => jest.advanceTimersByTime(5 * 60000));
  expect(first.result.current).toBeNull();
  expect(second.result.current).toBeNull();
});

test('focus and returning after browser sleep cannot revive an expired login', () => {
  startSession(user);
  const tab = renderHook(observe);
  act(() => jest.setSystemTime(Date.now() + SESSION_DURATION_MS));
  act(() => window.dispatchEvent(new Event('focus')));
  act(() => window.dispatchEvent(new Event('pointerdown')));
  expect(tab.result.current).toBeNull();
});

test('an activity update published by another tab refreshes the shared deadline', () => {
  startSession(user);
  const tab = renderHook(observe);
  act(() => jest.advanceTimersByTime(10 * 60000));
  act(() => {
    const saved = JSON.parse(localStorage.getItem('user'));
    saved._session.lastActiveAt = Date.now();
    saved._session.expiresAt = Date.now() + SESSION_DURATION_MS;
    localStorage.setItem('user', JSON.stringify(saved));
    window.dispatchEvent(new StorageEvent('storage', { key: 'user' }));
  });
  act(() => jest.advanceTimersByTime(10 * 60000));
  expect(tab.result.current).toEqual(user);
  act(() => jest.advanceTimersByTime(5 * 60000));
  expect(tab.result.current).toBeNull();
});
