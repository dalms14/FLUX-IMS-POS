import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import { UserAccountSettings } from './SettingsPage';

jest.mock('axios');
jest.mock('../components/Sidebar', () => () => null);

const roles = [{ role: 'custom', jobRole: 'Inventory Clerk', permissions: ['dashboard', 'inventory'] }];
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('user', JSON.stringify({ role: 'owner', email: 'owner@example.com' }));
  jest.resetAllMocks();
  axios.get.mockResolvedValue({ data: { data: roles } });
});
const applyRole = async () => {
  const option = await screen.findByRole('option', { name: 'Inventory Clerk (2 pages)' });
  fireEvent.change(screen.getByLabelText('Reuse an existing role'), { target: { value: option.value } });
};

test('applying a template changes only role and permissions, which remain editable', async () => {
  render(<UserAccountSettings />);
  fireEvent.change(screen.getByPlaceholderText('e.g. Maria Santos'), { target: { value: 'New Staff' } });
  fireEvent.change(screen.getByPlaceholderText('staff.personal@gmail.com'), { target: { value: 'new@example.com' } });
  fireEvent.change(screen.getByPlaceholderText('Minimum 6 characters'), { target: { value: 'temporary123' } });
  fireEvent.change(screen.getByPlaceholderText('6 digits'), { target: { value: '123456' } });
  fireEvent.change(screen.getByPlaceholderText('Auto-generated if blank'), { target: { value: 'ELI999' } });
  await applyRole();
  expect(screen.getByPlaceholderText('e.g. Finance')).toHaveValue('Inventory Clerk');
  expect(screen.getByRole('checkbox', { name: 'Dashboard' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Inventory' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Sales' })).not.toBeChecked();
  expect(screen.getByPlaceholderText('e.g. Maria Santos')).toHaveValue('New Staff');
  expect(screen.getByPlaceholderText('staff.personal@gmail.com')).toHaveValue('new@example.com');
  expect(screen.getByPlaceholderText('Minimum 6 characters')).toHaveValue('temporary123');
  expect(screen.getByPlaceholderText('6 digits')).toHaveValue('123456');
  expect(screen.getByPlaceholderText('Auto-generated if blank')).toHaveValue('ELI999');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Sales' }));
  expect(screen.getByRole('checkbox', { name: 'Sales' })).toBeChecked();
  expect(screen.getByLabelText('Reuse an existing role')).toHaveValue('');
  expect(axios.post).not.toHaveBeenCalled();
});

test('template access is sent through the normal verified-account creation flow', async () => {
  axios.post.mockResolvedValueOnce({ data: { message: 'Code sent' } }).mockResolvedValueOnce({ data: { user: { name: 'New Staff', jobRole: 'Inventory Clerk', userId: 'ELI999' } } });
  render(<UserAccountSettings />);
  await applyRole();
  fireEvent.change(screen.getByPlaceholderText('e.g. Maria Santos'), { target: { value: 'New Staff' } });
  fireEvent.change(screen.getByPlaceholderText('staff.personal@gmail.com'), { target: { value: 'new@example.com' } });
  fireEvent.change(screen.getByPlaceholderText('Minimum 6 characters'), { target: { value: 'temporary123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create User & Send Verification Code' }));
  await screen.findByText('Verify personal email');
  expect(screen.getByLabelText('Reuse an existing role')).toBeDisabled();
  fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify Email & Create User' }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith('http://localhost:5000/api/auth/users', expect.objectContaining({ role: 'custom', jobRole: 'Inventory Clerk', permissions: ['dashboard', 'inventory'], email: 'new@example.com', verificationCode: '123456' })));
  await screen.findByText(/Email verified. Created New Staff/);
  expect(screen.getByLabelText('Reuse an existing role')).toHaveValue('');
  await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
});

test('a template loading failure leaves manual creation available and supports retry', async () => {
  axios.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: { data: roles } });
  render(<UserAccountSettings />);
  await screen.findByText(/Could not load existing roles/);
  expect(screen.getByRole('button', { name: 'Create User & Send Verification Code' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await applyRole();
  expect(screen.getByPlaceholderText('e.g. Finance')).toHaveValue('Inventory Clerk');
});

test('users without account-creation access cannot load role templates', () => {
  localStorage.setItem('user', JSON.stringify({ role: 'staff' }));
  render(<UserAccountSettings />);
  expect(screen.queryByLabelText('Reuse an existing role')).not.toBeInTheDocument();
  expect(axios.get).not.toHaveBeenCalled();
});
