import React from 'react';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import TransactionPage from './TransactionPage';
import RefundModal from '../components/modals/RefundModal';

jest.mock('../components/Sidebar', () => () => null);
jest.mock('../components/ReceiptViewModal', () => () => null);
jest.mock('react-router-dom', () => ({
  useSearchParams: () => {
    const [query, setQuery] = require('react').useState(() => globalThis.window.location.search);
    return [new URLSearchParams(query), (next) => setQuery(current => {
      const params = typeof next === 'function' ? next(new URLSearchParams(current)) : new URLSearchParams(next);
      const search = params.toString();
      globalThis.window.history.replaceState({}, '', `/transactions${search ? `?${search}` : ''}`);
      return search;
    })];
  },
}), { virtual: true });
const sale = {
  _id: '123456789012345678901234', receiptNo: 'FLX-REFUND-TEST', orderStatus: 'completed', paymentMethod: 'Cash', total: 240,
  cashier: 'Cashier', createdAt: '2026-11-05T04:00:00Z',
  items: [{ originalIndex: 0, name: 'Coffee', quantity: 3, price: 100, subtotal: 300, refundedQuantity: 0,
    refundableQuantity: 3, reservedRefundQuantity: 0, refundLineAmounts: { subtotal: 30000, tax: 0, discount: 6000, total: 24000 } }],
  refundSummary: { canRefund: true, totalRefunded: 0, remainingAmount: 240 },
};
const reply = (data, ok = true) => Promise.resolve({ ok, json: async () => data });
let currentSale;
beforeEach(() => {
  window.history.replaceState({}, '', '/transactions');
  Object.defineProperty(window, 'crypto', { configurable: true, value: { getRandomValues: array => require('crypto').randomFillSync(array) } });
  localStorage.clear(); localStorage.setItem('user', JSON.stringify({ role: 'staff' }));
  currentSale = JSON.parse(JSON.stringify(sale));
  global.fetch = jest.fn((url, options) => {
    if (options?.method === 'POST') {
      currentSale.items[0].refundedQuantity = 2; currentSale.items[0].refundableQuantity = 1;
      currentSale.refundSummary.totalRefunded = 160; currentSale.refundSummary.remainingAmount = 80;
      return reply({ success: true, data: { totalRefunded: 160, paymentMethod: 'Cash' } });
    }
    return reply({ data: url.endsWith(sale._id) ? currentSale : [currentSale] });
  });
});
afterEach(() => { jest.restoreAllMocks(); window.history.replaceState({}, '', '/'); });

test('dashboard link selects completed status and the full Philippine business day, including after reload', async () => {
  window.history.replaceState({}, '', '/transactions?status=completed&startDate=2026-11-07&endDate=2026-11-07');
  const view = render(<TransactionPage />);
  await screen.findByText(sale.receiptNo);
  expect(screen.getByLabelText('Filter by Status')).toHaveValue('completed');
  expect(screen.getByLabelText('Start Date')).toHaveValue('2026-11-07');
  expect(screen.getByLabelText('End Date')).toHaveValue('2026-11-07');
  const params = new URL(fetch.mock.calls[0][0]).searchParams;
  expect(params.get('status')).toBe('completed');
  expect(params.get('startDate')).toBe('2026-11-07T00:00:00+08:00');
  expect(params.get('endDate')).toBe('2026-11-07T23:59:59.999+08:00');
  view.unmount();
  render(<TransactionPage />);
  expect(screen.getByLabelText('Filter by Status')).toHaveValue('completed');
  await screen.findByText(sale.receiptNo);
});

test('status changes combine with other filters and Clear removes the dashboard defaults', async () => {
  window.history.replaceState({}, '', '/transactions?status=completed&startDate=2026-11-07&endDate=2026-11-07&cashier=Cashier&paymentMethod=Cash');
  render(<TransactionPage />);
  await screen.findByText(sale.receiptNo);
  fireEvent.change(screen.getByLabelText('Filter by Status'), { target: { value: 'cancelled' } });
  await waitFor(() => {
    const params = new URL(fetch.mock.calls.at(-1)[0]).searchParams;
    expect(params.get('status')).toBe('cancelled');
    expect(params.get('cashier')).toBe('Cashier');
    expect(params.get('paymentMethod')).toBe('Cash');
    expect(params.get('startDate')).toBe('2026-11-07T00:00:00+08:00');
  });
  await screen.findByText(sale.receiptNo);
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  expect(screen.getByLabelText('Filter by Status')).toHaveValue('');
  expect(screen.getByLabelText('Start Date')).toHaveValue('');
  expect(screen.getByLabelText('End Date')).toHaveValue('');
  await waitFor(() => expect(new URL(fetch.mock.calls.at(-1)[0]).search).toBe(''));
  await screen.findByText(sale.receiptNo);
});

test('refund status is shown consistently in the transaction row and details', async () => {
  currentSale.refundSummary.status = 'partial refund';
  currentSale.refundSummary.totalRefunded = 80;
  render(<TransactionPage />);
  fireEvent.click(await screen.findByText(sale.receiptNo));
  expect(screen.getAllByText('Partial refund')).toHaveLength(3); // Filter option, table status, details status.
});

test('a slower previous request cannot overwrite the newly selected status', async () => {
  let resolveInitial;
  fetch.mockImplementationOnce(() => new Promise(resolve => { resolveInitial = resolve; }));
  fetch.mockImplementation(() => reply({ data: [{ ...sale, receiptNo: 'FLX-CANCELLED', orderStatus: 'cancelled', paymentMethod: 'Cancelled' }] }));
  render(<TransactionPage />);
  fireEvent.change(screen.getByLabelText('Filter by Status'), { target: { value: 'cancelled' } });
  await screen.findByText('FLX-CANCELLED');
  await act(async () => { resolveInitial(await reply({ data: [sale] })); });
  expect(screen.getByText('FLX-CANCELLED')).toBeInTheDocument();
  expect(screen.queryByText(sale.receiptNo)).not.toBeInTheDocument();
});

test('cashier refunds selected quantities from a completed sale and sees the refreshed refund amount', async () => {
  render(<TransactionPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Refund' }));
  const modal = await screen.findByRole('dialog', { name: 'Refund transaction' });
  expect(await within(modal).findByText('Coffee')).toBeInTheDocument();
  const confirm = within(modal).getByRole('button', { name: 'Confirm refund' });
  expect(confirm).toBeDisabled();
  fireEvent.click(within(modal).getByRole('checkbox', { name: 'Refund Coffee (item 1)' }));
  fireEvent.change(within(modal).getByRole('spinbutton'), { target: { value: '2' } });
  fireEvent.change(within(modal).getByLabelText('Reason for refund'), { target: { value: 'Wrong order served' } });
  expect(within(modal).getByText('₱160.00')).toBeInTheDocument();
  fireEvent.click(confirm);
  expect(await screen.findByRole('status')).toHaveTextContent('Refund recorded: ₱160');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await screen.findByText('Refunded: ₱160')).toBeInTheDocument();
  const post = fetch.mock.calls.find(([, options]) => options?.method === 'POST');
  expect(JSON.parse(post[1].body)).toEqual({
    transactionId: sale._id, requestId: expect.stringMatching(/^[a-f0-9]{32}$/),
    items: [{ originalIndex: 0, quantity: 2 }], reason: 'Wrong order served',
  });
});

test('fully refunded, cancelled or unauthorized transactions have no Refund action', async () => {
  currentSale.refundSummary = { canRefund: false, totalRefunded: 240, remainingAmount: 0 };
  const view = render(<TransactionPage />);
  await screen.findByText('Refunded: ₱240');
  expect(screen.queryByRole('button', { name: 'Refund' })).not.toBeInTheDocument();
  view.unmount();
  currentSale = { ...sale, orderStatus: 'cancelled', paymentMethod: 'Cancelled', refundSummary: { canRefund: false } };
  const cancelled = render(<TransactionPage />);
  await screen.findByText('FLX-REFUND-TEST');
  expect(screen.queryByRole('button', { name: 'Refund' })).not.toBeInTheDocument();
  cancelled.unmount(); currentSale = sale;
  localStorage.setItem('user', JSON.stringify({ role: 'custom', permissions: ['items'] }));
  render(<TransactionPage />);
  await screen.findByText('FLX-REFUND-TEST');
  expect(screen.queryByRole('button', { name: 'Refund' })).not.toBeInTheDocument();
});

test('failed save preserves selections and reuses the request identifier when retried', async () => {
  let attempts = 0;
  fetch.mockImplementation((url, options) => options?.method === 'POST'
    ? ++attempts === 1 ? Promise.reject(new Error('Connection lost')) : reply({ data: { totalRefunded: 80, paymentMethod: 'Cash' } })
    : reply({ data: sale }));
  const onClose = jest.fn(), onSuccess = jest.fn();
  render(<RefundModal isOpen transaction={sale} onClose={onClose} onSuccess={onSuccess} />);
  fireEvent.click(await screen.findByRole('checkbox'));
  fireEvent.change(screen.getByLabelText('Reason for refund'), { target: { value: 'Customer request' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm refund' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection lost');
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm refund' }));
  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  const posts = fetch.mock.calls.filter(([, options]) => options?.method === 'POST');
  expect(JSON.parse(posts[0][1].body).requestId).toBe(JSON.parse(posts[1][1].body).requestId);
});

test('fresh receipt data blocks stale quantities and invalid quantity input cannot be submitted', async () => {
  const fresh = { ...sale, items: [{ ...sale.items[0], refundableQuantity: 1, refundedQuantity: 2 }] };
  fetch.mockImplementation(() => reply({ data: fresh }));
  render(<RefundModal isOpen transaction={sale} onClose={jest.fn()} />);
  fireEvent.click(await screen.findByRole('checkbox'));
  expect(screen.getByRole('spinbutton')).toHaveAttribute('max', '1');
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Reason for refund'), { target: { value: 'Customer request' } });
  expect(screen.getByRole('button', { name: 'Confirm refund' })).toBeDisabled();
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '0.5' } });
  expect(screen.getByRole('button', { name: 'Confirm refund' })).toBeDisabled();
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1' } });
  expect(screen.getByRole('button', { name: 'Confirm refund' })).toBeEnabled();
  expect(screen.getByText('₱80.00')).toBeInTheDocument();
});
