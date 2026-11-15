import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axios from 'axios';
import InventoryPage from './InventoryPage';
import PurchaseOrdersPage from './PurchaseOrdersPage';

jest.mock('axios');
jest.mock('../components/Sidebar', () => () => null);
let savedCategories;
beforeEach(() => {
  jest.resetAllMocks(); localStorage.clear();
  localStorage.setItem('user', JSON.stringify({ role: 'owner', email: 'owner@example.com' }));
  savedCategories = ['General', 'Coffee', 'Other'];
  axios.get.mockImplementation(url => Promise.resolve({ data: url.endsWith('/inventory/categories') ? { data: [...savedCategories] }
    : url.endsWith('/auth/users') ? { data: [] } : [] }));
  axios.post.mockImplementation((url, data) => {
    if (url.endsWith('/inventory/categories')) {
      savedCategories.push(data.name);
      return Promise.resolve({ data: { category: { name: data.name } } });
    }
    return Promise.resolve({ data: { order: { ...data, _id: 'po1', purchaseOrderNo: 'PO-NEW', status: 'Draft' } } });
  });
});

async function createFrom(triggerName) {
  fireEvent.click(screen.getByRole('combobox', { name: triggerName }));
  await screen.findByRole('option', { name: 'Coffee' });
  fireEvent.click(screen.getByRole('option', { name: '+ New category' }));
  return screen.getByRole('group', { name: 'Create inventory category' });
}

test('a category created in Inventory survives reopening and can be submitted on a purchase order', async () => {
  const inventory = render(<InventoryPage />);
  await screen.findByText('No inventory items found.');
  const editor = await createFrom('Category');
  const input = within(editor).getByLabelText('New category name');
  expect(input).toHaveFocus();
  fireEvent.change(input, { target: { value: '  Cleaning   Supplies  ' } });
  fireEvent.click(within(editor).getByRole('button', { name: 'Save category' }));
  await waitFor(() => expect(screen.queryByRole('group')).not.toBeInTheDocument());
  expect(screen.getByRole('combobox', { name: 'Category' })).toHaveTextContent('Cleaning Supplies');
  expect(axios.post).toHaveBeenCalledWith('http://localhost:5000/api/inventory/categories', { name: 'Cleaning Supplies' });
  inventory.unmount();

  render(<PurchaseOrdersPage />);
  fireEvent.click(screen.getByRole('button', { name: 'New Purchase Order' }));
  fireEvent.click(screen.getByRole('combobox', { name: 'Category for line 1' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Cleaning Supplies' }));
  fireEvent.change(screen.getByLabelText('Supplier *'), { target: { value: 'Supplier' } });
  fireEvent.click(screen.getByRole('button', { name: /Any Staff/ }));
  fireEvent.change(screen.getByPlaceholderText('New ingredient name'), { target: { value: 'Cleaning Powder' } });
  fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create Draft PO' }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith('http://localhost:5000/api/purchase-orders', expect.objectContaining({
    items: [expect.objectContaining({ category: 'Cleaning Supplies', name: 'Cleaning Powder' })],
  })));
});

test('new PO categories are available on every line, and Enter saves only the category', async () => {
  render(<PurchaseOrdersPage />);
  fireEvent.click(screen.getByRole('button', { name: 'New Purchase Order' }));
  const editor = await createFrom('Category for line 1');
  const input = within(editor).getByLabelText('New category name');
  fireEvent.change(input, { target: { value: 'Cups' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(screen.queryByRole('group')).not.toBeInTheDocument());
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('combobox', { name: 'Category for line 1' })).toHaveTextContent('Cups');
  fireEvent.click(screen.getByRole('button', { name: 'Add line item' }));
  fireEvent.click(screen.getByRole('combobox', { name: 'Category for line 2' }));
  expect(screen.getByRole('option', { name: 'Cups' })).toBeInTheDocument();
});

test('empty and duplicate names are rejected; save failures retain the name for retry and block duplicate requests', async () => {
  render(<InventoryPage />);
  const editor = await createFrom('Category');
  const input = within(editor).getByLabelText('New category name');
  const save = within(editor).getByRole('button', { name: 'Save category' });
  fireEvent.click(save);
  expect(screen.getByRole('alert')).toHaveTextContent('between 1 and 80');
  fireEvent.change(input, { target: { value: ' coffee ' } });
  fireEvent.click(save);
  expect(screen.getByRole('alert')).toHaveTextContent('already exists');
  expect(axios.post).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: 'Cleaning Supplies' } });
  axios.post.mockRejectedValueOnce({ response: { data: { message: 'Connection lost. Try again.' } } });
  fireEvent.click(save);
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection lost');
  expect(input).toHaveValue('Cleaning Supplies');
  let finish;
  axios.post.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  fireEvent.click(save);
  fireEvent.click(save);
  expect(save).toBeDisabled();
  expect(axios.post).toHaveBeenCalledTimes(2);
  await act(async () => finish({ data: { category: { name: 'Cleaning Supplies' } } }));
  expect(screen.queryByRole('group')).not.toBeInTheDocument();
});

test('cancelling a category preserves the selection and restores focus; failed loading can be retried', async () => {
  axios.get.mockRejectedValueOnce(new Error('Offline'));
  render(<InventoryPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  const editor = await createFrom('Category');
  fireEvent.keyDown(within(editor).getByLabelText('New category name'), { key: 'Escape' });
  const trigger = screen.getByRole('combobox', { name: 'Category' });
  expect(trigger).toHaveTextContent('All Categories');
  expect(trigger).toHaveFocus();
  expect(screen.queryByRole('group')).not.toBeInTheDocument();
  expect(axios.post).not.toHaveBeenCalled();
});

test('a category filter includes legacy items with different casing or surrounding spaces', async () => {
  const previousGet = axios.get.getMockImplementation();
  axios.get.mockImplementation(url => url.endsWith('/inventory') ? Promise.resolve({ data: [
    { _id: 'a', name: 'Arabica', category: 'Coffee', unit: 'g', stock: 1, lowStockAt: 0 },
    { _id: 'b', name: 'Robusta', category: ' coffee ', unit: 'g', stock: 1, lowStockAt: 0 },
  ] }) : previousGet(url));
  render(<InventoryPage />);
  await screen.findByText('Arabica');
  fireEvent.click(screen.getByRole('combobox', { name: 'Category' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Coffee' }));
  expect(screen.getByText('Arabica')).toBeInTheDocument();
  expect(screen.getByText('Robusta')).toBeInTheDocument();
});
