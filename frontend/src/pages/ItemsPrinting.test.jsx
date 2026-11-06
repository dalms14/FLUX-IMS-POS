import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import Items from './Items';
import { printReceipt } from '../utils/printReceipt';

jest.mock('axios');
jest.mock('../components/Sidebar', () => () => null);
jest.mock('../utils/printReceipt', () => ({ printReceipt: jest.fn() }));

beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  localStorage.setItem('fluxCashierSession', JSON.stringify({ cart: [
    { _id: 'coffee', cartKey: 'coffee', name: 'Coffee', price: 100, quantity: 2 },
  ] }));
  axios.get.mockImplementation(url => Promise.resolve({ data: url.endsWith('/discounts') ? { data: [] } : [] }));
  printReceipt.mockResolvedValue(undefined);
});

const confirmOrder = async () => {
  await screen.findByText('No products found.');
  fireEvent.click(screen.getByRole('button', { name: 'Proceed to Checkout' }));
  fireEvent.change(screen.getByPlaceholderText(/Minimum/), { target: { value: '250' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Order' }));
};

test('Confirm Order prints the saved server receipt only after success, then New Order clears the receipt', async () => {
  let saveOrder;
  axios.post.mockImplementation(() => new Promise(resolve => { saveOrder = resolve; }));
  render(<Items />);
  await confirmOrder();
  await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
  expect(printReceipt).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog', { name: 'Receipt', exact: true })).not.toBeInTheDocument();
  await act(async () => saveOrder({ data: {
    success: true, receiptNo: 'FLX-PRINT-SAVED', transactionId: 'saved',
    checkout: { items: [{ name: 'Verified Coffee', quantity: 2, price: 90 }], subtotal: 180, discount: 0, total: 180, paymentMethod: 'Cash', amountTendered: 250, change: 70 },
  } }));
  const receipt = await screen.findByRole('dialog', { name: 'Receipt', exact: true });
  await waitFor(() => expect(printReceipt).toHaveBeenCalledTimes(1));
  const printedContent = printReceipt.mock.calls[0][0];
  expect(printedContent).toHaveTextContent('FLX-PRINT-SAVED');
  expect(printedContent).toHaveTextContent('Verified Coffee');
  expect(printedContent).toHaveTextContent('TOTAL AMOUNT:₱180');
  expect(printedContent.querySelector('button')).toBeNull();
  expect(within(receipt).getAllByRole('button')).toHaveLength(1);
  const newOrder = within(receipt).getByRole('button', { name: 'New Order' });
  await waitFor(() => expect(newOrder).toBeEnabled());
  fireEvent.click(newOrder);
  expect(screen.queryByRole('dialog', { name: 'Receipt', exact: true })).not.toBeInTheDocument();
  expect(screen.getByText('No items added yet.')).toBeInTheDocument();
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(printReceipt).toHaveBeenCalledTimes(1);
});

test('failed checkout never requests printing and retains the cart for retry', async () => {
  axios.post.mockRejectedValue({ response: { data: { message: 'Could not save this order.' } } });
  render(<Items />);
  await confirmOrder();
  await screen.findByText('Order failed');
  expect(printReceipt).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog', { name: 'Receipt', exact: true })).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('fluxCashierSession')).cart).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Confirm Order' })).toBeEnabled();
});
