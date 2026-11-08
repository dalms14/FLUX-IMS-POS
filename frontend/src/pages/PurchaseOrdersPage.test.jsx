import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import PurchaseOrdersPage from './PurchaseOrdersPage';
import Dashboard from './Dashboard';

jest.mock('axios');
jest.mock('../components/Sidebar', () => () => null);

const order = {
  _id: 'po1', purchaseOrderNo: 'PO-TEST', supplierName: 'Coffee Supplier', supplierEmail: 'orders@supplier.com', status: 'Approved',
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
      { _id: 'archived-admin', role: 'admin', name: 'Archived Admin', email: 'archived@example.com', archived: true },
      { _id: 'staff', role: 'staff', name: 'Staff', email: 'staff@example.com' },
      { _id: 'operations', role: 'custom', jobRole: 'Operations', name: 'Athan Scott Saroca', userId: 'ELI020', email: 'operations@example.com' },
    ] } : url.endsWith('/purchase-orders') ? [order] : url.includes('/my-deliveries') ? { data: [order] } : [],
  }));
});

test('new orders sort ingredients, list staff and admins, and shared assignments do not require a specific person', async () => {
  render(<PurchaseOrdersPage />);
  await screen.findByText('PO-TEST');
  fireEvent.click(screen.getByRole('button', { name: 'New Purchase Order' }));
  fireEvent.focus(screen.getByRole('combobox', { name: 'Ingredient / material' }));
  const ingredient = screen.getByRole('listbox', { name: 'Inventory items' });
  expect(within(ingredient).getAllByRole('option').map(option => option.textContent)).toEqual(['New inventory item...', 'Apple (kg)', 'Zucchini (kg)']);
  expect(screen.getByRole('option', { name: 'Admin — admin' })).toHaveValue('admin@example.com');
  expect(screen.queryByRole('option', { name: /Archived Admin/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('option', { name: /Owner — owner/ })).not.toBeInTheDocument();
  const receiver = screen.getByRole('option', { name: /Staff — staff/ }).parentElement;
  expect(receiver).toBeRequired();
  expect(screen.getByRole('option', { name: 'Athan Scott Saroca — Operations (ELI020)' })).toHaveValue('operations@example.com');
  fireEvent.click(screen.getByRole('button', { name: /Any Staff/ }));
  expect(receiver).not.toBeRequired();
});

test('supplier templates save and restore name, phone and email when assigning an admin', async () => {
  axios.post.mockImplementation((url, data) => Promise.resolve({ data: { order: {
    ...order, ...data, status: 'Draft', assignedReceiver: { name: 'Admin', email: data.assignedReceiverEmail },
  } } }));
  render(<PurchaseOrdersPage />);
  await screen.findByText('PO-TEST');
  fireEvent.click(screen.getByRole('button', { name: 'New Purchase Order' }));
  fireEvent.change(screen.getByLabelText('Supplier *'), { target: { value: 'Metro Food Supply' } });
  fireEvent.change(screen.getByLabelText('Supplier Phone Number'), { target: { value: '09171234567' } });
  fireEvent.change(screen.getByLabelText('Supplier Email Address'), { target: { value: 'orders@metro.com' } });
  fireEvent.change(screen.getByLabelText('Assigned Receiver (Staff / Admin) *'), { target: { value: 'admin@example.com' } });
  fireEvent.focus(screen.getByRole('combobox', { name: 'Ingredient / material' }));
  fireEvent.click(screen.getByRole('option', { name: 'Apple (kg)' }));
  fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create Draft PO' }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith('http://localhost:5000/api/purchase-orders', expect.objectContaining({
    supplierName: 'Metro Food Supply', supplierContact: '09171234567', supplierEmail: 'orders@metro.com', assignedReceiverEmail: 'admin@example.com',
  })));
  await screen.findByText('PO-TEST created as a draft.');
  expect(JSON.parse(localStorage.getItem('flux.purchaseOrderSupplierHistory'))).toEqual([
    { name: 'Metro Food Supply', contact: '09171234567', email: 'orders@metro.com' },
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'New Purchase Order' }));
  fireEvent.focus(screen.getByLabelText('Supplier *'));
  expect(screen.getByText('orders@metro.com')).toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole('button', { name: 'Remove Metro Food Supply from supplier history' }).parentElement);
  expect(screen.getByLabelText('Supplier *')).toHaveValue('Metro Food Supply');
  expect(screen.getByLabelText('Supplier Phone Number')).toHaveValue('09171234567');
  expect(screen.getByLabelText('Supplier Email Address')).toHaveValue('orders@metro.com');
});

test('old supplier templates without email still fill the phone and clear a previous email', async () => {
  localStorage.setItem('flux.purchaseOrderSupplierHistory', JSON.stringify([{ name: 'Old Supplier', contact: '09170000000' }]));
  render(<PurchaseOrdersPage />);
  await screen.findByText('PO-TEST');
  fireEvent.click(screen.getByRole('button', { name: 'New Purchase Order' }));
  fireEvent.change(screen.getByLabelText('Supplier Email Address'), { target: { value: 'different@supplier.com' } });
  fireEvent.focus(screen.getByLabelText('Supplier *'));
  fireEvent.mouseDown(screen.getByRole('button', { name: 'Remove Old Supplier from supplier history' }).parentElement);
  expect(screen.getByLabelText('Supplier Phone Number')).toHaveValue('09170000000');
  expect(screen.getByLabelText('Supplier Email Address')).toHaveValue('');
});

test('supplier phone removes non-digits, caps pasted input, and blocks a short number', async () => {
  render(<PurchaseOrdersPage />);
  await screen.findByText('PO-TEST');
  fireEvent.click(screen.getByRole('button', { name: 'New Purchase Order' }));
  fireEvent.change(screen.getByLabelText('Supplier *'), { target: { value: 'Supplier' } });
  const phone = screen.getByLabelText('Supplier Phone Number');
  fireEvent.change(phone, { target: { value: 'letters' } });
  expect(phone).toHaveValue('');
  fireEvent.change(phone, { target: { value: '09ab17-123 4567xyz890' } });
  expect(phone).toHaveValue('09171234567');
  expect(phone).toBeValid();
  fireEvent.change(phone, { target: { value: '0917123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create Draft PO' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Supplier phone number must be exactly 11 digits.');
  expect(phone).toHaveFocus();
  expect(axios.post).not.toHaveBeenCalled();
});

test('invalid supplier email prevents creating an order', async () => {
  render(<PurchaseOrdersPage />);
  await screen.findByText('PO-TEST');
  fireEvent.click(screen.getByRole('button', { name: 'New Purchase Order' }));
  fireEvent.change(screen.getByLabelText('Supplier *'), { target: { value: 'Supplier' } });
  fireEvent.change(screen.getByLabelText('Supplier Email Address'), { target: { value: 'invalid-address' } });
  fireEvent.click(screen.getByRole('button', { name: /Any Staff/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Create Draft PO' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email address.');
  expect(axios.post).not.toHaveBeenCalled();
});

test('owners can view a staff-only purchase order without receiving it or editing its details', async () => {
  render(<PurchaseOrdersPage />);
  await screen.findByText('PO-TEST');
  expect(screen.queryByRole('button', { name: 'Report Arrival' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View' }));
  const dialog = screen.getByRole('dialog', { name: 'Purchase order details' });
  expect(dialog).toHaveTextContent('Coffee Beans');
  expect(dialog).toHaveTextContent('orders@supplier.com');
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

test('a failed sales request does not hide the Operations account delivery due today', async () => {
  const existingGet = axios.get.getMockImplementation();
  axios.get.mockImplementation(url => url.endsWith('/transactions') ? Promise.reject(new Error('Sales unavailable')) : existingGet(url));
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.setItem('user', JSON.stringify({ role: 'custom', jobRole: 'Operations', name: 'Athan Scott Saroca', email: 'operations@example.com' }));
  render(<Dashboard />);
  expect(await screen.findByRole('button', { name: 'View Items' })).toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith('http://localhost:5000/api/purchase-orders/my-deliveries?email=operations%40example.com');
  log.mockRestore();
});

test('an empty assignment list is explained instead of hiding the whole delivery section', async () => {
  const existingGet = axios.get.getMockImplementation();
  axios.get.mockImplementation(url => url.includes('/my-deliveries') ? Promise.resolve({ data: { data: [] } }) : existingGet(url));
  render(<Dashboard />);
  expect(await screen.findByText('No approved purchase orders are currently assigned to this account.')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'My Assigned Deliveries' })).toBeInTheDocument();
});

test('reporting a delivery from the dashboard submits it for review without calling approval', async () => {
  localStorage.setItem('user', JSON.stringify({ role: 'staff', email: 'staff@example.com' }));
  axios.post.mockResolvedValue({ data: { order: { ...order, status: 'Arrival Pending Approval' } } });
  render(<Dashboard />);
  fireEvent.click(await screen.findByRole('button', { name: 'Record Delivery' }));
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } });
  const buttons = screen.getAllByRole('button', { name: 'Record Delivery' });
  fireEvent.click(buttons[buttons.length - 1]);
  await screen.findByRole('heading', { name: 'My Assigned Deliveries' });
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.post.mock.calls[0][0]).toMatch(/\/record-arrival$/);
});
