import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
