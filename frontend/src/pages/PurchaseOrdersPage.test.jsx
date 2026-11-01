import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import PurchaseOrdersPage from './PurchaseOrdersPage';
import Dashboard from './Dashboard';

jest.mock('axios');
jest.mock('../components/Sidebar', () => () => null);

const order = {
  _id: 'po1', purchaseOrderNo: 'PO-TEST', supplierName: 'Coffee Supplier', status: 'Approved',
  assignedReceiver: { name: 'Any Staff', email: '__any_staff__' },
  items: [{ _id: 'item1', name: 'Coffee Beans', unit: 'kg', orderedQuantity: 10, receivedQuantity: 2 }],
};

beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  localStorage.setItem('user', JSON.stringify({ role: 'owner', email: 'owner@example.com' }));
  axios.get.mockImplementation(url => Promise.resolve({ data:
    url.endsWith('/inventory') ? [{ _id: 'z', name: 'Zucchini', unit: 'kg' }, { _id: 'a', name: 'Apple', unit: 'kg' }] :
    url.endsWith('/auth/users') ? { data: [
      { _id: 'owner', role: 'owner', name: 'Owner', email: 'owner@example.com' },
      { _id: 'admin', role: 'admin', name: 'Admin', email: 'admin@example.com' },
      { _id: 'staff', role: 'staff', name: 'Staff', email: 'staff@example.com' },
    ] } : url.endsWith('/purchase-orders') ? [order] : url.includes('/my-deliveries') ? { data: [order] } : [],
  }));
});

test('new orders sort ingredients, list only staff, and shared assignments do not require a specific person', async () => {
  render(<PurchaseOrdersPage />);
  await screen.findByText('PO-TEST');
  fireEvent.click(screen.getByRole('button', { name: 'New Purchase Order' }));
  fireEvent.focus(screen.getByRole('combobox', { name: 'Ingredient / material' }));
  const ingredient = screen.getByRole('listbox', { name: 'Inventory items' });
  expect(within(ingredient).getAllByRole('option').map(option => option.textContent)).toEqual(['New inventory item...', 'Apple (kg)', 'Zucchini (kg)']);
  expect(screen.queryByRole('option', { name: /Admin — admin/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('option', { name: /Owner — owner/ })).not.toBeInTheDocument();
  const receiver = screen.getByRole('option', { name: /Staff — staff/ }).parentElement;
  expect(receiver).toBeRequired();
  fireEvent.click(screen.getByRole('button', { name: /Any Staff/ }));
  expect(receiver).not.toBeRequired();
});

test('owners can view a staff-only purchase order without receiving it or editing its details', async () => {
  render(<PurchaseOrdersPage />);
  await screen.findByText('PO-TEST');
  expect(screen.queryByRole('button', { name: 'Report Arrival' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View' }));
  const dialog = screen.getByRole('dialog', { name: 'Purchase order details' });
  expect(dialog).toHaveTextContent('Coffee Beans');
  expect(dialog).toHaveTextContent('10 kg');
  expect(dialog).toHaveTextContent('8 kg');
  expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
  expect(axios.post).not.toHaveBeenCalled();
});

test('inventory search filters each order line and selects an existing item with the keyboard', async () => {
  render(<PurchaseOrdersPage />);
  await screen.findByText('PO-TEST');
  fireEvent.click(screen.getByRole('button', { name: 'New Purchase Order' }));
  const search = screen.getByRole('combobox', { name: 'Ingredient / material' });
  fireEvent.focus(search);
  fireEvent.change(search, { target: { value: 'ZUC' } });
  expect(screen.queryByRole('option', { name: 'Apple (kg)' })).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Zucchini (kg)' })).toBeInTheDocument();
  fireEvent.keyDown(search, { key: 'Enter' });
  expect(search).toHaveValue('Zucchini (kg)');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(screen.queryByPlaceholderText('New ingredient name')).not.toBeInTheDocument();
  expect(axios.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Add line item' }));
  const second = screen.getAllByRole('combobox', { name: 'Ingredient / material' })[1];
  fireEvent.focus(second);
  fireEvent.change(second, { target: { value: 'not found' } });
  expect(screen.getByRole('status')).toHaveTextContent('No matching inventory items.');
  fireEvent.click(screen.getByRole('option', { name: 'New inventory item...' }));
  expect(screen.getByPlaceholderText('New ingredient name')).toBeInTheDocument();
  expect(search).toHaveValue('Zucchini (kg)');
});

test('assigned staff can inspect the expected delivery on their dashboard before recording anything', async () => {
  localStorage.setItem('user', JSON.stringify({ role: 'staff', email: 'staff@example.com' }));
  render(<Dashboard />);
  fireEvent.click(await screen.findByRole('button', { name: 'View Items' }));
  const dialog = screen.getByRole('dialog', { name: 'Purchase order details' });
  expect(dialog).toHaveTextContent('Coffee Beans');
  expect(dialog).toHaveTextContent('10 kg');
  expect(axios.post).not.toHaveBeenCalled();
});
