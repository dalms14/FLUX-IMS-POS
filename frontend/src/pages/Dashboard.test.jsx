import React from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import Dashboard from './Dashboard';

jest.mock('axios');
jest.mock('../components/Sidebar', () => () => null);

const sale = (fields = {}) => ({
  _id: 'paid', receiptNo: 'FLX-PAID', total: 2154, orderStatus: 'completed', paymentMethod: 'Cash',
  createdAt: '2026-11-06T18:00:00Z', items: [{ quantity: 2 }], ...fields,
});
const metric = label => within(screen.getByText(label).closest('.dashboard-metric'));
let transactions;

beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-07T02:00:00Z'));
  localStorage.clear();
  localStorage.setItem('user', JSON.stringify({ role: 'owner' }));
  transactions = [];
  axios.get.mockImplementation(url => Promise.resolve({ data: { data: url.endsWith('/transactions') ? transactions : [] } }));
});
afterEach(() => jest.useRealTimers());

test('cancelled transactions stay in recent history but do not inflate revenue, orders, items or refund counts', async () => {
  transactions = [
    sale(),
    sale({ _id: 'cancelled', receiptNo: 'FLX-CANCELLED', total: 115440, orderStatus: 'cancelled', paymentMethod: 'Cancelled', items: [{ quantity: 80 }] }),
    sale({ _id: 'legacy-cancel', receiptNo: 'FLX-LEGACY-CANCEL', total: 27840, paymentMethod: 'Cancelled', items: [{ quantity: 20 }] }),
    sale({ _id: 'pending', receiptNo: 'FLX-PENDING', total: 1000, orderStatus: 'pending' }),
  ];
  render(<Dashboard />);
  await screen.findByText('FLX-CANCELLED');
  expect(metric("Today's Revenue").getByText(/2,154/)).toBeInTheDocument();
  expect(metric("Today's Revenue").getByText('1 completed order')).toBeInTheDocument();
  expect(metric('Total Orders').getByText('1')).toBeInTheDocument();
  expect(metric('Items Sold').getByText('2')).toBeInTheDocument();
  expect(metric('Completed').getByText('1')).toBeInTheDocument();
  expect(metric('Completed').getByText('No refunds today')).toBeInTheDocument();
  expect(screen.getByText('FLX-LEGACY-CANCEL')).toBeInTheDocument();
  expect(screen.queryByText(/with refund activity/)).not.toBeInTheDocument();
  expect(document.querySelector('.dashboard-metric-trend')).toBeNull();
});

test('an all-cancelled day has zero revenue, orders and items', async () => {
  transactions = [sale({ orderStatus: 'cancelled', total: 115440 })];
  render(<Dashboard />);
  await screen.findByText('FLX-PAID');
  expect(metric("Today's Revenue").getByText(/^₱0$/)).toBeInTheDocument();
  expect(metric('Total Orders').getByText('0')).toBeInTheDocument();
  expect(metric('Items Sold').getByText('0')).toBeInTheDocument();
  expect(metric('Completed').getByText('No refunds today')).toBeInTheDocument();
});

test('today follows Philippine midnight and refreshes after a sale becomes cancelled', async () => {
  transactions = [
    sale(), // Nov 7 in Manila, even though still Nov 6 in UTC.
    sale({ _id: 'yesterday', receiptNo: 'FLX-YESTERDAY', total: 500, createdAt: '2026-11-06T15:59:59Z' }),
    sale({ _id: 'tomorrow', receiptNo: 'FLX-TOMORROW', total: 900, createdAt: '2026-11-07T16:00:00Z' }),
  ];
  render(<Dashboard />);
  await screen.findByText('FLX-PAID');
  expect(metric("Today's Revenue").getByText(/2,154/)).toBeInTheDocument();
  transactions = transactions.map(row => row._id === 'paid' ? { ...row, orderStatus: 'cancelled' } : row);
  await act(async () => window.dispatchEvent(new Event('focus')));
  await waitFor(() => expect(metric("Today's Revenue").getByText('0 completed orders')).toBeInTheDocument());
  expect(metric('Total Orders').getByText('0')).toBeInTheDocument();
});
