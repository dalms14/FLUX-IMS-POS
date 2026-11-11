import React from 'react';
import { act, render, screen } from '@testing-library/react';
import axios from 'axios';
import ShiftEndCountdown from './ShiftEndCountdown';
import { getSessionUser, recordSessionActivity, startSession, updateSessionShift, getSessionId } from '../utils/session';

jest.mock('axios');
const ends = new Date('2026-11-09T12:30:00+08:00').getTime();
const shiftSession = { shiftEndsAt: new Date(ends).toISOString(), signOutAt: new Date(ends + 300000).toISOString(), timeZone: 'Asia/Manila' };
const account = { email: 'staff@example.com', role: 'staff', sessionToken: 'a'.repeat(64) };
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  jest.useFakeTimers(); jest.setSystemTime(ends - 1000);
  axios.post.mockReset(); axios.post.mockResolvedValue({ data: {} });
});
afterEach(() => jest.useRealTimers());
const login = (changes = {}) => startSession({ ...account, shiftSession, serverNow: new Date(Date.now()).toISOString(), ...changes });

test('countdown begins at Philippine shift end and signs out at the absolute deadline despite activity', () => {
  login();
  render(<ShiftEndCountdown />);
  expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByRole('timer')).toHaveTextContent('5:00');
  act(() => { jest.advanceTimersByTime(120000); recordSessionActivity(); });
  expect(screen.getByRole('timer')).toHaveTextContent('3:00');
  act(() => jest.advanceTimersByTime(180000));
  expect(getSessionUser()).toBeNull();
  expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.post.mock.calls[0][2].headers.Authorization).toBe(`Bearer ${account.sessionToken}`);
});

test('a reload during wrap-up keeps the remaining time and uses server time even with a wrong device clock', () => {
  jest.setSystemTime(ends - 3600000);
  login({ serverNow: new Date(ends + 120000).toISOString() });
  render(<ShiftEndCountdown />);
  expect(screen.getByRole('timer')).toHaveTextContent('3:00');
});

test('returning from a suspended tab past the deadline signs out immediately', () => {
  login(); render(<ShiftEndCountdown />);
  act(() => {
    jest.setSystemTime(ends + 360000);
    window.dispatchEvent(new Event('focus'));
  });
  expect(getSessionUser()).toBeNull();
});

test.each(['owner', 'admin'])('%s accounts remain exempt', role => {
  jest.setSystemTime(ends + 60000);
  login({ role }); render(<ShiftEndCountdown />);
  expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  act(() => jest.advanceTimersByTime(300000));
  expect(getSessionUser()).not.toBeNull();
});

test('a live schedule update resets the deadline and disabling restrictions removes the countdown', () => {
  jest.setSystemTime(ends + 60000);
  login(); render(<ShiftEndCountdown />);
  const id = getSessionId();
  expect(screen.getByRole('timer')).toHaveTextContent('4:00');
  act(() => updateSessionShift(id, { shiftSession: { ...shiftSession, shiftEndsAt: new Date(ends + 3600000).toISOString(), signOutAt: new Date(ends + 3900000).toISOString() }, serverNow: new Date().toISOString() }));
  expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  act(() => updateSessionShift(id, { shiftSession: null, serverNow: new Date().toISOString() }));
  act(() => jest.advanceTimersByTime(300000));
  expect(getSessionUser()).not.toBeNull();
});
