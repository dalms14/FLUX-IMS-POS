import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
