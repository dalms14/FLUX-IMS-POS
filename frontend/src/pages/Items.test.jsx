import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import Items from './Items';
import { ELITE_MEMBER_HISTORY_KEY } from '../utils/eliteMemberHistory';

jest.mock('axios');
jest.mock('../components/Sidebar', () => () => <nav>Navigation</nav>);
jest.mock('../components/ReceiptViewModal', () => props => <div role="dialog" aria-label="Saved receipt">
  <span>{props.receiptNo}</span><span>{props.cart[0].name}</span>
  <span>Receipt total: {props.total}</span>
  <button onClick={props.onClose}>New Order</button>
</div>);

beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  localStorage.setItem('fluxCashierSession', JSON.stringify({ cart: [
    { _id: 'coffee', cartKey: 'coffee', name: 'Test Coffee', price: 100, quantity: 2 },
  ] }));
  axios.get.mockImplementation(url => Promise.resolve({ data: url.endsWith('/discounts') ? { data: [] } : [] }));
});

test.each(['Cash', 'GCash'])('%s checkout opens the receipt and returns to an empty POS without an order board', async payment => {
  axios.post.mockResolvedValue({ data: { success: true, receiptNo: 'FLX-TEST', orderStatus: 'completed' } });
  render(<Items />);
  await screen.findByText('No products found.');
  expect(screen.queryByRole('button', { name: 'Active Orders' })).not.toBeInTheDocument();
  expect(axios.get.mock.calls.some(([url]) => url.includes('/orders/active'))).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Proceed to Checkout' }));
  if (payment === 'GCash') fireEvent.click(screen.getByRole('button', { name: 'GCash' }));
  fireEvent.change(screen.getByPlaceholderText(payment === 'Cash' ? /Minimum/ : 'e.g. 1234567890'), {
    target: { value: payment === 'Cash' ? '250' : '1234567890' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Order' }));
  expect(await screen.findByRole('dialog', { name: 'Saved receipt' })).toHaveTextContent('FLX-TEST');
  expect(screen.getByText('Receipt total: 200')).toBeInTheDocument();
  expect(axios.post).toHaveBeenCalledWith('http://localhost:5000/api/transactions', expect.objectContaining({
    paymentMethod: payment, total: 200, items: [expect.objectContaining({ name: 'Test Coffee', quantity: 2 })],
  }));
  fireEvent.click(screen.getByRole('button', { name: 'New Order' }));
  expect(screen.getByText('No items added yet.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Proceed to Checkout' })).toBeDisabled();
  await waitFor(() => expect(JSON.parse(localStorage.getItem('fluxCashierSession')).cart).toEqual([]));
});

test('stock rejection keeps the cart and does not show a saved receipt', async () => {
  axios.post.mockRejectedValue({ response: { data: { code: 'INSUFFICIENT_STOCK', shortages: [] } } });
  render(<Items />);
  await screen.findByText('No products found.');
  fireEvent.click(screen.getByRole('button', { name: 'Proceed to Checkout' }));
  fireEvent.change(screen.getByPlaceholderText(/Minimum/), { target: { value: '250' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Order' }));
  await screen.findByText('Order cannot be processed');
  expect(screen.queryByRole('dialog', { name: 'Saved receipt' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Proceed to Checkout' })).toBeEnabled();
  expect(JSON.parse(localStorage.getItem('fluxCashierSession')).cart).toHaveLength(1);
});

test('server failure is caught in checkout, preserves the cart, and allows a successful retry', async () => {
  axios.post.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Failed to save transaction.' } } })
    .mockResolvedValueOnce({ data: { success: true, receiptNo: 'FLX-RETRY', orderStatus: 'completed' } });
  render(<Items />);
  await screen.findByText('No products found.');
  fireEvent.click(screen.getByRole('button', { name: 'Proceed to Checkout' }));
  fireEvent.change(screen.getByPlaceholderText(/Minimum/), { target: { value: '250' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Order' }));
  await screen.findByText('Order failed');
  expect(screen.getAllByText('Failed to save transaction.')).toHaveLength(2);
  expect(screen.queryByRole('dialog', { name: 'Saved receipt' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Confirm Order' })).toBeEnabled();
  expect(JSON.parse(localStorage.getItem('fluxCashierSession')).cart).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Order' }));
  expect(await screen.findByRole('dialog', { name: 'Saved receipt' })).toHaveTextContent('FLX-RETRY');
});

test('a saved Elite Member applies to the current order and reaches checkout with a 12 digit card', async () => {
  const member = { name: 'Daniel Almojera', idNumber: '001234567890' };
  localStorage.setItem(ELITE_MEMBER_HISTORY_KEY, JSON.stringify([member]));
  axios.post.mockResolvedValue({ data: { success: true, receiptNo: 'FLX-ELITE', orderStatus: 'completed' } });
  render(<Items />);
  await screen.findByText('No products found.');
  fireEvent.click(screen.getByRole('button', { name: 'Elite Member' }));
  fireEvent.change(screen.getByLabelText('Saved member'), { target: { value: member.idNumber } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  expect(screen.queryByRole('dialog', { name: 'Elite Membership Verification' })).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('fluxCashierSession')).eliteMember).toEqual(member);
  fireEvent.click(screen.getByRole('button', { name: 'Proceed to Checkout' }));
  fireEvent.change(screen.getByPlaceholderText(/Minimum/), { target: { value: '200' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Order' }));
  await screen.findByRole('dialog', { name: 'Saved receipt' });
  expect(axios.post).toHaveBeenCalledWith('http://localhost:5000/api/transactions', expect.objectContaining({
    customerType: 'elite', eliteMember: member, discount: 40, total: 160,
  }));
});

test('an old cashier session with an invalid card must re-enter membership details', async () => {
  const saved = JSON.parse(localStorage.getItem('fluxCashierSession'));
  localStorage.setItem('fluxCashierSession', JSON.stringify({ ...saved, customerType: 'elite', discountApplied: true,
    eliteMember: { name: 'Old member', idNumber: '1234567890123' },
  }));
  render(<Items />);
  await screen.findByText('No products found.');
  const session = JSON.parse(localStorage.getItem('fluxCashierSession'));
  expect(session.customerType).toBe('customer');
  expect(session.eliteMember).toBeNull();
  expect(session.discountApplied).toBe(false);
});


test('GCash accepts digits only, including pasted input, and blocks a short reference', async () => {
  render(<Items />);
  await screen.findByText('No products found.');
  fireEvent.click(screen.getByRole('button', { name: 'Proceed to Checkout' }));
  fireEvent.click(screen.getByRole('button', { name: 'GCash' }));
  const reference = screen.getByPlaceholderText('e.g. 1234567890');
  fireEvent.change(reference, { target: { value: 'abc001234567890x' } });
  expect(reference).toHaveValue('001234567890');
  fireEvent.change(reference, { target: { value: 'abc12' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Order' }));
  await screen.findByText('Enter 10 to 13 digits for the GCash reference number.');
  expect(axios.post).not.toHaveBeenCalled();
});

test('two PWD diners automatically discount only the top two units and preserve the allocation at checkout', async () => {
  localStorage.setItem('fluxCashierSession', JSON.stringify({ cart: [
    { _id: 'coffee', cartKey: 'coffee', name: 'Coffee', price: 100, quantity: 4 },
    { _id: 'cake', cartKey: 'cake', name: 'Cake', price: 200, quantity: 2 },
    { _id: 'meal', cartKey: 'meal', name: 'Meal', price: 300, quantity: 1 },
  ] }));
  axios.post.mockResolvedValue({ data: { success: true, receiptNo: 'FLX-PWD' } });
  render(<Items />);
  await screen.findByText('No products found.');
  fireEvent.click(screen.getByRole('button', { name: 'Apply Discount' }));
  fireEvent.click(screen.getByRole('button', { name: /PWD\/Senior Citizen/ }));
  const count = screen.getByLabelText('How many people have this discount?');
  fireEvent.change(count, { target: { value: '2' } });
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Discounted people' })).getByRole('button', { name: 'Apply Discount' }));
  expect(screen.queryByRole('dialog', { name: 'Discounted people' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Proceed to Checkout' }));
  fireEvent.change(screen.getByPlaceholderText(/Minimum/), { target: { value: '1000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Order' }));
  await screen.findByRole('dialog', { name: 'Saved receipt' });
  expect(axios.post).toHaveBeenCalledWith('http://localhost:5000/api/transactions', expect.objectContaining({
    discount: 100, total: 1000,
    items: expect.arrayContaining([
      expect.objectContaining({ name: 'Coffee', discountEligibleQuantity: 0 }),
      expect.objectContaining({ name: 'Cake', discountEligibleQuantity: 1 }),
      expect.objectContaining({ name: 'Meal', discountEligibleQuantity: 1 }),
    ]),
  }));
});

test('the printed receipt uses the saved checkout items returned by the server', async () => {
  axios.post.mockResolvedValue({ data: { success: true, receiptNo: 'FLX-VERIFIED', checkout: {
    items: [{ productId: 'coffee', name: 'Saved Coffee Name', price: 100, quantity: 2 }],
    subtotal: 200, discount: 0, total: 200, paymentMethod: 'Cash', amountTendered: 250, change: 50, cashier: 'Verified Cashier', customerType: 'customer',
  } } });
  render(<Items />);
  await screen.findByText('No products found.');
  fireEvent.click(screen.getByRole('button', { name: 'Proceed to Checkout' }));
  fireEvent.change(screen.getByPlaceholderText(/Minimum/), { target: { value: '250' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Order' }));
  const receipt = await screen.findByRole('dialog', { name: 'Saved receipt' });
  expect(receipt).toHaveTextContent('Saved Coffee Name');
  expect(receipt).toHaveTextContent('Receipt total: 200');
});
