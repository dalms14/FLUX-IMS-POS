import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import { SystemBackupSettings } from './SettingsPage';

jest.mock('axios');
jest.mock('../components/Sidebar', () => () => null);
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('user', JSON.stringify({ role: 'owner', email: 'owner@example.com', name: 'Owner' }));
  jest.resetAllMocks();
});
afterEach(() => jest.restoreAllMocks());
const openPopup = () => {
  render(<SystemBackupSettings />);
  fireEvent.click(screen.getByRole('button', { name: 'Export Backup File' }));
};

test('opens the designed popup with a masked password and lets the owner cancel without exporting', () => {
  openPopup();
  expect(screen.getByRole('dialog', { name: 'Export database backup' })).toBeInTheDocument();
  expect(screen.getByLabelText('Owner password')).toHaveAttribute('type', 'password');
  expect(screen.getByRole('button', { name: 'Export backup' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
  expect(screen.getByLabelText('Owner password')).toHaveAttribute('type', 'text');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(axios.post).not.toHaveBeenCalled();
});

test('shows password errors inside the popup and clears the field on reopening', async () => {
  axios.post.mockRejectedValue({ response: { status: 403 } });
  openPopup();
  fireEvent.change(screen.getByLabelText('Owner password'), { target: { value: 'wrong-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Export backup' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('alert')).toHaveTextContent('owner password could not be verified');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(localStorage.getItem('lastBackupAt')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Export Backup File' }));
  expect(screen.getByLabelText('Owner password')).toHaveValue('');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('keeps the owner password check and closes after a successful download', async () => {
  const createUrl = jest.fn(() => 'blob:backup-test');
  const revokeUrl = jest.fn();
  URL.createObjectURL = createUrl;
  URL.revokeObjectURL = revokeUrl;
  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  let finish;
  axios.post.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  openPopup();
  fireEvent.change(screen.getByLabelText('Owner password'), { target: { value: 'owner-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Export backup' }));
  expect(screen.getByRole('button', { name: 'Exporting...' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  finish({ data: { backup: { createdAt: '2026-10-23T00:00:00Z', data: {} } } });
  await screen.findByText('Backup file exported successfully.');
  expect(axios.post).toHaveBeenCalledWith('http://localhost:5000/api/system/backup', { email: 'owner@example.com', password: 'owner-password' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(localStorage.getItem('lastBackupAt')).toBe('2026-10-23T00:00:00Z');
  expect(createUrl).toHaveBeenCalledTimes(1);
  expect(revokeUrl).toHaveBeenCalledWith('blob:backup-test');
});

test('Escape dismisses the popup before an export starts', async () => {
  openPopup();
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(axios.post).not.toHaveBeenCalled();
});
