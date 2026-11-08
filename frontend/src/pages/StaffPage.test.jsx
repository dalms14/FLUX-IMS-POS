import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import StaffPage from './StaffPage';
import CreateAccountPage from './CreateAccountPage';
import SettingsPage from './SettingsPage';

jest.mock('axios');
jest.mock('../components/Sidebar', () => () => null);
jest.mock('react-router-dom', () => ({ Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });

const target = { _id: 'clerk', name: 'Clerk', role: 'custom', jobRole: 'Assistant', email: 'clerk@example.com', permissions: ['staff', 'users'] };
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('user', JSON.stringify({ role: 'owner', email: 'owner@example.com' }));
  jest.resetAllMocks();
  axios.get.mockResolvedValue({ data: { data: [target] } });
  axios.put.mockResolvedValue({ data: { user: target } });
});

test('Users links to account creation, which includes a return link to Users', async () => {
  const page = render(<StaffPage />);
  expect(screen.getByRole('link', { name: 'Create Account' })).toHaveAttribute('href', '/staff/create');
  await screen.findByText('Clerk');
  page.unmount();
  render(<CreateAccountPage />);
  expect(screen.getByRole('heading', { name: 'Create Account', exact: true })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to Users' })).toHaveAttribute('href', '/staff');
  await screen.findByRole('option', { name: /Assistant/ });
});

test.each([[['staff']], [['users']]])('Users hides account creation for insufficient access: %j', async permissions => {
  localStorage.setItem('user', JSON.stringify({ role: 'custom', permissions }));
  render(<StaffPage />);
  await screen.findByText('Clerk');
  expect(screen.queryByRole('link', { name: 'Create Account' })).not.toBeInTheDocument();
});

test('editing access clears and locks Create Accounts when Users is unchecked, and saves the cleared access', async () => {
  render(<StaffPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Access' }));
  const users = screen.getByRole('checkbox', { name: 'Users', exact: true });
  const createAccounts = screen.getByRole('checkbox', { name: 'Create Accounts', exact: true });
  expect(createAccounts).toBeChecked();
  fireEvent.click(users);
  expect(createAccounts).toBeDisabled();
  expect(createAccounts).not.toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Save Access' }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith('http://localhost:5000/api/auth/users/clerk/access', expect.objectContaining({ permissions: [] })));
});

test('Settings no longer offers account creation', () => {
  render(<SettingsPage />);
  expect(screen.queryByRole('button', { name: /Create Account/i })).not.toBeInTheDocument();
});

const shift = { workdays: ['monday', 'friday'], startTime: '22:00', endTime: '06:00', restrictLogin: true, earlyLoginMinutes: 15, timeZone: 'Asia/Manila' };

test('legacy users start with restriction off and an empty schedule', async () => {
  render(<StaffPage />);
  expect(await screen.findByText('No shift assigned')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Shift' }));
  const dialog = screen.getByRole('dialog', { name: 'Edit shift' });
  expect(within(dialog).getByRole('checkbox', { name: 'Restrict login to shift' })).not.toBeChecked();
  expect(within(dialog).getByLabelText('Shift start')).toHaveValue('');
  expect(within(dialog).getByLabelText('Shift end')).toHaveValue('');
  expect(within(dialog).getByLabelText('Early login allowance (minutes)')).toHaveValue(15);
  expect(within(dialog).getByText(/Outside-shift attempts are recorded in Login Activity/)).toBeInTheDocument();
  expect(axios.put).not.toHaveBeenCalled();
});

test('an overnight shift saves, survives a reload, and appears in the user details', async () => {
  let stored = target;
  axios.get.mockImplementation(() => Promise.resolve({ data: { data: [stored] } }));
  axios.put.mockImplementation((url, body) => {
    stored = { ...target, shiftSchedule: body.shiftSchedule };
    return Promise.resolve({ data: { user: stored } });
  });
  const page = render(<StaffPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Shift' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Monday', exact: true }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Friday', exact: true }));
  fireEvent.change(screen.getByLabelText('Shift start'), { target: { value: '22:00' } });
  fireEvent.change(screen.getByLabelText('Shift end'), { target: { value: '06:00' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Restrict login to shift' }));
  expect(screen.getByText(/This shift ends the following day/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save shift' }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith('http://localhost:5000/api/auth/users/clerk/shift', { shiftSchedule: shift }));
  expect(await screen.findByRole('status')).toHaveTextContent('Shift schedule saved');
  expect(screen.getByText('Mon, Fri · 10:00 PM–6:00 AM (+1 day) · PHT')).toBeInTheDocument();
  page.unmount();
  render(<StaffPage />);
  fireEvent.click(await screen.findByText('Clerk'));
  await waitFor(() => expect(screen.queryByText('Loading activity...')).not.toBeInTheDocument());
  const details = screen.getByRole('region', { name: 'Shift schedule' });
  expect(details).toHaveTextContent('Mon, Fri · 10:00 PM–6:00 AM (+1 day) · PHT');
  expect(details).toHaveTextContent('Restrict login to shift: On');
  expect(details).toHaveTextContent('Early login allowance: 15 minutes');
  fireEvent.click(within(details).getByRole('button', { name: 'Edit Shift' }));
  expect(screen.getByRole('checkbox', { name: 'Friday', exact: true })).toBeChecked();
  expect(screen.getByLabelText('Shift start')).toHaveValue('22:00');
});

test.each([
  [{ role: 'admin', permissions: ['staff', 'users'] }, true],
  [{ role: 'admin', permissions: ['staff'] }, false],
  [{ role: 'custom', permissions: ['staff', 'users'] }, false],
  [{ role: 'staff', permissions: ['staff', 'users'] }, false],
])('shift editing follows account management access: %j', async (account, allowed) => {
  localStorage.setItem('user', JSON.stringify(account));
  render(<StaffPage />);
  await screen.findByText('Clerk');
  expect(Boolean(screen.queryByRole('button', { name: 'Edit Shift' }))).toBe(allowed);
});

test('owner and archived accounts have no shift edit action', async () => {
  axios.get.mockResolvedValue({ data: { data: [{ ...target, role: 'owner' }] } });
  const page = render(<StaffPage />);
  expect(await screen.findByText('Shift exempt')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Edit Shift' })).not.toBeInTheDocument();
  page.unmount();
  axios.get.mockResolvedValue({ data: { data: [target] } });
  render(<StaffPage />);
  await screen.findByText('Clerk');
  fireEvent.click(screen.getByRole('button', { name: 'Archived Users' }));
  await screen.findByText('Clerk');
  expect(screen.queryByRole('button', { name: 'Edit Shift' })).not.toBeInTheDocument();
});

test('incomplete and equal-time shifts show errors without saving', async () => {
  render(<StaffPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Shift' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Restrict login to shift' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save shift' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Select at least one workday');
  expect(screen.getByRole('checkbox', { name: 'Monday', exact: true })).toHaveFocus();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Monday', exact: true }));
  fireEvent.change(screen.getByLabelText('Shift start'), { target: { value: '08:00' } });
  fireEvent.change(screen.getByLabelText('Shift end'), { target: { value: '08:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save shift' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Shift start and end times must be different');
  expect(axios.put).not.toHaveBeenCalled();
});

test('clearing a schedule resets its restriction flag; cancellation does not save', async () => {
  axios.get.mockResolvedValue({ data: { data: [{ ...target, shiftSchedule: shift }] } });
  render(<StaffPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Shift' }));
  fireEvent.click(screen.getByRole('button', { name: 'Clear schedule' }));
  expect(screen.getByRole('checkbox', { name: 'Restrict login to shift' })).not.toBeChecked();
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
  expect(axios.put).not.toHaveBeenCalled();
  expect(screen.getByText('Mon, Fri · 10:00 PM–6:00 AM (+1 day) · PHT')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Shift' }));
  fireEvent.click(screen.getByRole('button', { name: 'Clear schedule' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save shift' }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith('http://localhost:5000/api/auth/users/clerk/shift', { shiftSchedule: {
    workdays: [], startTime: '', endTime: '', restrictLogin: false, earlyLoginMinutes: 15, timeZone: 'Asia/Manila',
  } }));
});

test('a failed save retains shift changes and displays the server error', async () => {
  axios.put.mockRejectedValue({ response: { data: { message: 'Failed to save the shift schedule.' } } });
  render(<StaffPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Shift' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Tuesday', exact: true }));
  fireEvent.change(screen.getByLabelText('Shift start'), { target: { value: '08:00' } });
  fireEvent.change(screen.getByLabelText('Shift end'), { target: { value: '17:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save shift' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Failed to save the shift schedule.');
  expect(screen.getByRole('checkbox', { name: 'Tuesday', exact: true })).toBeChecked();
  expect(screen.getByLabelText('Shift end')).toHaveValue('17:00');
  expect(screen.getByRole('button', { name: 'Save shift' })).toBeEnabled();
});

test('user activity identifies an outside-shift attempt without calling it a logout', async () => {
  axios.get.mockImplementation(url => Promise.resolve({ data: { data: url.includes('/login-activity') ? [{
    action: 'login_blocked_off_shift', createdAt: '2026-11-08T23:00:00Z', shiftSchedule: shift, blockedReason: 'off_shift',
  }] : [target] } }));
  render(<StaffPage />);
  fireEvent.click(await screen.findByText('Clerk'));
  expect(await screen.findByText('Blocked — Outside shift')).toBeInTheDocument();
  expect(screen.queryByText('Logged out')).not.toBeInTheDocument();
  expect(screen.getByText(/^Mon, Fri · 10:00 PM/)).toHaveTextContent('Early login allowance: 15 minutes');
});
