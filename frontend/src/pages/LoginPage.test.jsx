import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import LoginPage from './LoginPage';
import { getSessionUser } from '../utils/session';
import { loadSystemPage } from '../utils/documentNavigation';
import { needsLoginWarmup, waitForLoginServer } from '../utils/loginServer';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate, Navigate: ({ to }) => <span>Redirecting to {to}</span> }), { virtual: true });
jest.mock('axios');
jest.mock('../utils/documentNavigation', () => ({ loadSystemPage: jest.fn() }));
jest.mock('../utils/loginServer', () => ({ needsLoginWarmup: jest.fn(), waitForLoginServer: jest.fn() }));
beforeEach(() => {
  jest.resetAllMocks(); localStorage.clear(); sessionStorage.clear();
  axios.get.mockResolvedValue({ data: { locked: false, attemptsRemaining: 3 } });
});
const open = () => {
  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'staff@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ValidSecret123' } });
  return screen.getByRole('button', { name: 'Sign In' }).closest('form');
};

test('sign-in saves the session and starts a real page load, without an overlay or an SPA redirect', async () => {
  let complete;
  axios.post.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  const form = open();
  fireEvent.submit(form);
  expect(screen.queryByRole('status', { name: 'Signing in' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Email')).toBeDisabled();
  expect(screen.getByLabelText('Password')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Forgot password?' })).toBeDisabled();
  fireEvent.submit(form);
  expect(axios.post).toHaveBeenCalledTimes(1);
  await act(async () => complete({ data: { email: 'staff@example.com', name: 'Staff', role: 'staff', sessionToken: 'a'.repeat(64) } }));
  expect(loadSystemPage).toHaveBeenCalledWith('/dashboard');
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(screen.queryByText(/Redirecting to/)).not.toBeInTheDocument();
  expect(getSessionUser().email).toBe('staff@example.com');
  expect(screen.queryByRole('status', { name: 'Signing in' })).not.toBeInTheDocument();
});

test('a rejected login removes the loader and allows correction without discarding the email', async () => {
  axios.post.mockRejectedValue({ response: { status: 401, data: { message: 'Invalid email or password.', attemptsRemaining: 2 } } });
  fireEvent.submit(open());
  expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument();
  expect(screen.queryByRole('status', { name: 'Signing in' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled();
  expect(screen.getByLabelText('Email')).toHaveValue('staff@example.com');
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(loadSystemPage).not.toHaveBeenCalled();
});

test('first-login password replacement still uses its restricted challenge without creating a full session', async () => {
  axios.post.mockResolvedValue({ data: { mustChangePassword: true, email: 'staff@example.com', passwordChangeToken: 'challenge' } });
  fireEvent.submit(open());
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/first-login-password', { replace: true }));
  expect(getSessionUser()).toBeNull();
  expect(loadSystemPage).not.toHaveBeenCalled();
  expect(JSON.parse(sessionStorage.getItem('firstLoginChallenge')).token).toBe('challenge');
});

test('network timeout clears the loader and offers a retry instead of claiming the password is incorrect', async () => {
  axios.post.mockRejectedValue({ code: 'ECONNABORTED', message: 'Timeout' });
  fireEvent.submit(open());
  expect(await screen.findByText(/Unable to connect/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled();
  expect(axios.post).toHaveBeenCalledWith('http://localhost:5000/api/auth/login', expect.any(Object), { timeout: 30000 });
});

test.each(['OUTSIDE_SHIFT', 'SHIFT_SCHEDULE_INVALID'])('shift denial explains the restriction without creating a session or counting a wrong password: %s', async code => {
  axios.post.mockRejectedValue({ response: { status: 403, data: { code, message: 'You cannot sign in outside your assigned shift. Next allowed sign-in: Monday at 7:45 AM (Philippine time).' } } });
  fireEvent.submit(open());
  expect(await screen.findByRole('alert')).toHaveTextContent('outside your assigned shift');
  expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled();
  expect(screen.getByLabelText('Email')).toHaveValue('staff@example.com');
  expect(getSessionUser()).toBeNull();
  expect(loadSystemPage).not.toHaveBeenCalled();
  expect(axios.get).not.toHaveBeenCalled();
  expect(screen.queryByLabelText(/attempts remaining/)).not.toBeInTheDocument();
});

test('hosted sign-in waits for readiness and ignores duplicate submissions before sending the password once', async () => {
  let ready;
  needsLoginWarmup.mockReturnValue(true);
  waitForLoginServer.mockImplementation(() => new Promise(resolve => { ready = resolve; }));
  axios.post.mockResolvedValue({ data: { email: 'staff@example.com', name: 'Staff', role: 'staff', sessionToken: 'a'.repeat(64) } });
  const form = open();
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(screen.getByRole('status')).toHaveTextContent('up to two minutes');
  expect(screen.getByRole('button', { name: 'Connecting...' })).toBeDisabled();
  expect(axios.post).not.toHaveBeenCalled();
  expect(waitForLoginServer).toHaveBeenCalledTimes(1);
  await act(async () => ready());
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(loadSystemPage).toHaveBeenCalledWith('/dashboard');
});

test('a server that does not wake leaves credentials unsent and allows a manual retry', async () => {
  needsLoginWarmup.mockReturnValue(true);
  waitForLoginServer.mockRejectedValue({ code: 'LOGIN_SERVER_UNAVAILABLE' });
  fireEvent.submit(open());
  expect(await screen.findByRole('alert')).toHaveTextContent('Your password has not been submitted');
  expect(axios.post).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(getSessionUser()).toBeNull();
});

test('leaving the login page cancels its outstanding warmup', () => {
  needsLoginWarmup.mockReturnValue(true);
  waitForLoginServer.mockReturnValue(new Promise(() => {}));
  const { unmount } = render(<LoginPage />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'staff@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ValidSecret123' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Sign In' }).closest('form'));
  const signal = waitForLoginServer.mock.calls[0][0];
  unmount();
  expect(signal.aborted).toBe(true);
  expect(axios.post).not.toHaveBeenCalled();
});
