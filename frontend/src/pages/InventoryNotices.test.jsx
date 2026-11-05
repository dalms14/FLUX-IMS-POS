import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axios from 'axios';
import InventoryPage from './InventoryPage';

jest.mock('axios');
jest.mock('../components/Sidebar', () => () => null);
const ingredient = { _id: 'beans', name: 'Coffee Beans', category: 'Coffee', unit: 'g', stock: 0, lowStockAt: 1, expirationBatches: [] };
beforeEach(() => {
  jest.resetAllMocks(); localStorage.clear();
  axios.get.mockImplementation(url => Promise.resolve({ data: url.endsWith('/inventory-stats') ? null : [{ ...ingredient, archived: url.includes('archived=true') }] }));
  jest.spyOn(window, 'alert').mockImplementation(() => {});
  jest.spyOn(window, 'confirm').mockImplementation(() => true);
});
afterEach(() => {
  expect(window.alert).not.toHaveBeenCalled();
  expect(window.confirm).not.toHaveBeenCalled();
  jest.restoreAllMocks();
});

test('archive asks through an on-screen dialog; cancelling or Escape keeps the ingredient unchanged', async () => {
  render(<InventoryPage />);
  const trigger = await screen.findByTitle('Archive ingredient');
  fireEvent.click(trigger);
  let dialog = screen.getByRole('alertdialog', { name: 'Archive ingredient' });
  expect(dialog).toHaveTextContent('Coffee Beans');
  expect(dialog).toHaveTextContent('stock must be zero');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  fireEvent.click(trigger);
  dialog = screen.getByRole('alertdialog');
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(axios.delete).not.toHaveBeenCalled();
});

test('archive errors show a notice, retain the ingredient, and let confirmation be retried successfully', async () => {
  axios.delete.mockRejectedValueOnce({ response: { data: { message: 'Stock must be zero before archiving.' } } }).mockResolvedValueOnce({ data: { success: true } });
  render(<InventoryPage />);
  fireEvent.click(await screen.findByTitle('Archive ingredient'));
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Archive' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Stock must be zero before archiving.');
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Archive' }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  await waitFor(() => expect(screen.queryByText('Coffee Beans')).not.toBeInTheDocument());
  expect(axios.delete).toHaveBeenCalledTimes(2);
});

test('an archive in progress disables duplicate confirmation until it finishes', async () => {
  let finish;
  axios.delete.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  render(<InventoryPage />);
  fireEvent.click(await screen.findByTitle('Archive ingredient'));
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Archive' }));
  const button = screen.getByRole('button', { name: 'Archiving...' });
  expect(button).toBeDisabled(); fireEvent.click(button);
  expect(axios.delete).toHaveBeenCalledTimes(1);
  await act(async () => finish({ data: { success: true } }));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

test('restore failures appear on screen and leave the archived ingredient available for retry', async () => {
  axios.post.mockRejectedValue({ response: { data: { message: 'Could not restore this ingredient.' } } });
  render(<InventoryPage />);
  await screen.findByText('Coffee Beans');
  fireEvent.click(screen.getByRole('button', { name: 'Archived Ingredients' }));
  fireEvent.click(await screen.findByTitle('Restore ingredient'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not restore this ingredient.');
  expect(screen.getByTitle('Restore ingredient')).toBeInTheDocument();
});

test('stock-out server errors show a notice without closing the form or discarding its quantity', async () => {
  axios.get.mockImplementation(url => Promise.resolve({ data: url.endsWith('/inventory-stats') ? null : [{ ...ingredient, stock: 10 }] }));
  axios.put.mockRejectedValue({ response: { data: { message: 'Stock changed. Refresh before trying again.' } } });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  render(<InventoryPage />);
  fireEvent.click(await screen.findByTitle('Stock Out'));
  fireEvent.change(screen.getByPlaceholderText('Max 10 g'), { target: { value: '2' } });
  fireEvent.change(screen.getByRole('option', { name: 'Damaged Stock' }).parentElement, { target: { value: 'Damaged stock' } });
  fireEvent.click(screen.getByRole('button', { name: 'Deduct Stock' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Stock changed. Refresh before trying again.');
  expect(screen.getByPlaceholderText('Max 10 g')).toHaveValue(2);
});
