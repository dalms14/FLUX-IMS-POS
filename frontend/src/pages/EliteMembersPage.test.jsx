import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axios from 'axios';
import EliteMembersPage from './EliteMembersPage';
import { startSession } from '../utils/session';

jest.mock('axios');
jest.mock('../components/Sidebar', () => () => null);
const member = { _id: 'member-1', name: 'Registered Member', idNumber: '001234', status: 'active', notes: '' };
beforeEach(() => {
  jest.resetAllMocks(); localStorage.clear();
  startSession({ role: 'owner', email: 'owner@example.com' });
  axios.get.mockResolvedValue({ data: { data: [member] } });
});

test('owner can register issued cards and keep leading zeroes', async () => {
  axios.post.mockResolvedValue({ data: { member } });
  render(<EliteMembersPage />);
  await screen.findByText(member.name);
  fireEvent.click(screen.getByRole('button', { name: 'Register card' }));
  const form = screen.getByRole('form', { name: 'Register issued card' });
  fireEvent.change(within(form).getByLabelText('Member name'), { target: { value: ' New Member ' } });
  fireEvent.change(within(form).getByLabelText(/Card ID/), { target: { value: '00ab123456789012345' } });
  expect(within(form).getByLabelText(/Card ID/)).toHaveValue('001234567890');
  fireEvent.click(within(form).getByRole('button', { name: 'Save member' }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith('http://localhost:5000/api/elite-members', { name: 'New Member', idNumber: '001234567890', email: '', status: 'active', notes: '' }));
  expect(await screen.findByRole('status')).toHaveTextContent('registered');
});

test('admin can edit member details and deactivate the existing card', async () => {
  startSession({ role: 'admin', email: 'admin@example.com', permissions: ['elite_members'] });
  axios.patch.mockResolvedValue({ data: { member } });
  render(<EliteMembersPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Edit Registered Member/ }));
  const form = screen.getByRole('form', { name: 'Edit member' });
  fireEvent.change(within(form).getByLabelText('Status'), { target: { value: 'inactive' } });
  fireEvent.click(within(form).getByRole('button', { name: 'Save member' }));
  await waitFor(() => expect(axios.patch).toHaveBeenCalledWith('http://localhost:5000/api/elite-members/member-1', { name: member.name, idNumber: member.idNumber, email: '', status: 'inactive', notes: '' }));
});

test('registration saves an optional email and displays it in the member list', async () => {
  let rows = [member];
  axios.get.mockImplementation(() => Promise.resolve({ data: { data: rows } }));
  axios.post.mockImplementation((url, values) => {
    rows = [{ ...member, ...values }];
    return Promise.resolve({ data: { member: rows[0] } });
  });
  render(<EliteMembersPage />);
  await screen.findByText(member.name);
  fireEvent.click(screen.getByRole('button', { name: 'Register card' }));
  const email = screen.getByLabelText('Email address (optional)');
  expect(email).not.toBeRequired();
  fireEvent.change(screen.getByLabelText('Member name'), { target: { value: 'New Member' } });
  fireEvent.change(screen.getByLabelText('Card ID'), { target: { value: '000123' } });
  fireEvent.change(email, { target: { value: ' member@example.com ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save member' }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith('http://localhost:5000/api/elite-members', expect.objectContaining({ email: 'member@example.com' })));
  expect(await screen.findByRole('cell', { name: 'member@example.com' })).toBeInTheDocument();
});

test.each(['updated@example.com', ''])('editing preloads the email and allows changing or clearing it: %s', async email => {
  axios.get.mockResolvedValue({ data: { data: [{ ...member, email: 'existing@example.com' }] } });
  axios.patch.mockResolvedValue({ data: { member } });
  render(<EliteMembersPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Edit Registered Member/ }));
  const input = screen.getByLabelText('Email address (optional)');
  expect(input).toHaveValue('existing@example.com');
  fireEvent.change(input, { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: 'Save member' }));
  await waitFor(() => expect(axios.patch).toHaveBeenCalledWith('http://localhost:5000/api/elite-members/member-1', expect.objectContaining({ email })));
});

test('invalid email shows an inline error and blocks saving until corrected', async () => {
  axios.patch.mockResolvedValue({ data: { member } });
  render(<EliteMembersPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Edit Registered Member/ }));
  const email = screen.getByLabelText('Email address (optional)');
  expect(email).toHaveValue('');
  fireEvent.change(email, { target: { value: 'invalid-email' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save member' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address');
  expect(email).toHaveFocus();
  expect(email).toHaveAttribute('aria-invalid', 'true');
  expect(axios.patch).not.toHaveBeenCalled();
  fireEvent.change(email, { target: { value: '' } });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save member' }));
  await waitFor(() => expect(axios.patch).toHaveBeenCalledWith('http://localhost:5000/api/elite-members/member-1', expect.objectContaining({ email: '' })));
});

test('custom membership-only role can load the member page and register cards', async () => {
  startSession({ role: 'custom', jobRole: 'Membership Clerk', email: 'clerk@example.com', permissions: ['elite_members'] });
  render(<EliteMembersPage />);
  expect(await screen.findByText(member.name)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Register card' })).toBeEnabled();
});

test('duplicate card errors retain the form so the owner can correct the entry', async () => {
  axios.post.mockRejectedValue({ response: { data: { message: 'That card ID is already registered.' } } });
  render(<EliteMembersPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Register card' }));
  fireEvent.change(screen.getByLabelText('Member name'), { target: { value: member.name } });
  fireEvent.change(screen.getByLabelText(/Card ID/), { target: { value: member.idNumber } });
  fireEvent.click(screen.getByRole('button', { name: 'Save member' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('already registered');
  expect(screen.getByRole('form')).toBeInTheDocument();
});

test.each([{ role: 'staff', permissions: ['products'] }, { role: 'admin', permissions: ['products'] }])('unauthorized account cannot load or edit registry: %s', user => {
  startSession({ ...user, email: 'test@example.com' });
  render(<EliteMembersPage />);
  expect(screen.getByRole('alert')).toHaveTextContent('Elite Membership access is required');
  expect(screen.queryByRole('button', { name: 'Register card' })).not.toBeInTheDocument();
  expect(axios.get).not.toHaveBeenCalled();
});

test('numeric typing and pasted digits cannot enter Member name, while accented names and punctuation can be saved', async () => {
  axios.post.mockResolvedValue({ data: { member } });
  render(<EliteMembersPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Register card' }));
  const input = screen.getByLabelText(/^Member name/);
  fireEvent.change(input, { target: { value: '123456789' } });
  expect(input).toHaveValue('');
  expect(screen.getByRole('alert')).toHaveTextContent('Numbers are not allowed');
  fireEvent.change(input, { target: { value: 'María O’Connor-Santos Jr.' } });
  expect(input).toHaveValue('María O’Connor-Santos Jr.');
  fireEvent.change(input, { target: { value: 'María123' } });
  expect(input).toHaveValue('María O’Connor-Santos Jr.');
  fireEvent.change(screen.getByLabelText(/Card ID/), { target: { value: '001234' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save member' }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith('http://localhost:5000/api/elite-members', expect.objectContaining({ name: 'María O’Connor-Santos Jr.' })));
});

test('an existing numeric name cannot be saved again until corrected', async () => {
  axios.get.mockResolvedValue({ data: { data: [{ ...member, name: '123456' }] } });
  render(<EliteMembersPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Edit 123456/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Save member' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Numbers are not allowed');
  expect(axios.patch).not.toHaveBeenCalled();
});

test('empty required fields show styled inline errors, focus the first field and block saving', async () => {
  render(<EliteMembersPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Register card' }));
  expect(screen.getByRole('form')).toHaveAttribute('novalidate');
  fireEvent.click(screen.getByRole('button', { name: 'Save member' }));
  expect(screen.getByText('Please enter the member’s name.')).toBeInTheDocument();
  expect(screen.getByText('Please enter the card ID.')).toBeInTheDocument();
  expect(screen.getByLabelText('Member name')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText('Member name')).toHaveFocus();
  expect(axios.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Member name'), { target: { value: 'Valid Member' } });
  expect(screen.queryByText('Please enter the member’s name.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save member' }));
  expect(screen.getByLabelText('Card ID')).toHaveFocus();
  fireEvent.change(screen.getByLabelText('Card ID'), { target: { value: '001234' } });
  expect(screen.queryByText('Please enter the card ID.')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Card ID')).toHaveAttribute('aria-invalid', 'false');
});

test('archive requires confirmation and archived members can be restored from their separate view', async () => {
  let archived = false;
  axios.get.mockImplementation(url => Promise.resolve({ data: { data: url.includes('archived=true') === archived ? [{ ...member, archived }] : [] } }));
  axios.post.mockImplementation(url => {
    archived = url.endsWith('/archive');
    return Promise.resolve({ data: { member: { ...member, archived } } });
  });
  render(<EliteMembersPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Archive Registered Member/ }));
  const dialog = screen.getByRole('dialog', { name: 'Archive member?' });
  expect(dialog).toHaveTextContent('Previous sales remain unchanged');
  expect(axios.post).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Archive member' }));
  await waitFor(() => expect(screen.queryByText(member.name)).not.toBeInTheDocument());
  expect(axios.post).toHaveBeenCalledWith('http://localhost:5000/api/elite-members/member-1/archive');
  fireEvent.click(screen.getByRole('button', { name: 'Archived members' }));
  fireEvent.click(await screen.findByRole('button', { name: /Restore Registered Member/ }));
  expect(screen.queryByRole('button', { name: /Edit Registered Member/ })).not.toBeInTheDocument();
  const restore = screen.getByRole('dialog', { name: 'Restore member?' });
  fireEvent.click(within(restore).getByRole('button', { name: 'Restore member' }));
  await waitFor(() => expect(axios.post).toHaveBeenLastCalledWith('http://localhost:5000/api/elite-members/member-1/restore'));
  await screen.findByText('No archived members found.');
  fireEvent.click(screen.getByRole('button', { name: 'Registered members' }));
  expect(await screen.findByRole('button', { name: /Edit Registered Member/ })).toBeInTheDocument();
});

test('cancelling archive leaves the member unchanged', async () => {
  render(<EliteMembersPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Archive Registered Member/ }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByText(member.name)).toBeInTheDocument();
  expect(axios.post).not.toHaveBeenCalled();
});

test('archive failure keeps the record and offers a retry in the dialog', async () => {
  axios.post.mockRejectedValue({ response: { data: { message: 'Unable to archive this member.' } } });
  render(<EliteMembersPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Archive Registered Member/ }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Archive member' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to archive');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Archive member' })).toBeEnabled();
});
