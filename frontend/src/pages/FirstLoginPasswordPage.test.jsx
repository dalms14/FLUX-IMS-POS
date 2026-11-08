import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import FirstLoginPasswordPage from './FirstLoginPasswordPage';
import { getSessionUser } from '../utils/session';
import { loadSystemPage } from '../utils/documentNavigation';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate, Navigate: () => null }), { virtual: true });
jest.mock('axios');
jest.mock('../utils/documentNavigation', () => ({ loadSystemPage: jest.fn() }));
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  jest.clearAllMocks();
  sessionStorage.setItem('firstLoginChallenge', JSON.stringify({ email: 'staff@example.com', token: 'test-token' }));
});
const openPage = () => render(<FirstLoginPasswordPage />);
const submit = (confirm = 'NewSecret123') => {
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'NewSecret123' } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: confirm } });
  fireEvent.submit(screen.getByRole('button', { name: 'Save password and continue' }).closest('form'));
};

test('requires matching passwords before calling the server', () => {
  openPage();
  submit('Mismatch123');
  expect(screen.getByRole('alert')).toHaveTextContent('New passwords do not match');
  expect(axios.post).not.toHaveBeenCalled();
  expect(getSessionUser()).toBeNull();
});

test('starts the remembered session only after a successful password change', async () => {
  axios.post.mockResolvedValue({ data: { user: { email: 'staff@example.com', role: 'owner' } } });
  openPage();
  submit();
  await waitFor(() => expect(loadSystemPage).toHaveBeenCalledWith('/dashboard'));
  expect(getSessionUser().email).toBe('staff@example.com');
  expect(sessionStorage.getItem('firstLoginChallenge')).toBeNull();
});

test('expired challenges cannot open a session and offer return to sign in', async () => {
  axios.post.mockRejectedValue({ response: { status: 401, data: { message: 'Request expired.' } } });
  openPage();
  submit();
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Request expired.'));
  expect(getSessionUser()).toBeNull();
  expect(screen.getByRole('button', { name: 'Save password and continue' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));
  expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
});

test('a shift ending during password setup cannot create a session', async () => {
  axios.post.mockRejectedValue({ response: { status: 403, data: { code: 'OUTSIDE_SHIFT', message: 'You cannot sign in outside your assigned shift.' } } });
  openPage();
  submit();
  expect(await screen.findByRole('alert')).toHaveTextContent('outside your assigned shift');
  expect(getSessionUser()).toBeNull();
  expect(loadSystemPage).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Back to sign in' })).toBeEnabled();
});
