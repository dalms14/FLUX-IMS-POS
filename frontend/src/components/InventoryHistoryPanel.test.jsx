import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import HistoryPage from './HistoryPage';
import InventoryHistoryPanel from './InventoryHistoryPanel';

jest.mock('./Sidebar', () => () => null);
const rows = [
  { _id: 'received', date: '2026-11-04T16:30:00Z', item: 'Milk', movementType: 'received', action: 'Stock In', quantity: '1,000 ml', direction: 'in', reference: 'PO-TEST-001', by: 'Finance', reason: 'Purchase order stock received' },
  { _id: 'sale', date: '2026-11-05T03:00:00Z', item: 'Milk', movementType: 'sale', action: 'Sale Deduction', quantity: '100 ml', direction: 'out', reference: 'FLX-TEST', by: 'Cashier' },
  { _id: 'expired', date: '2026-11-04T15:00:00Z', item: 'Cream', movementType: 'expired', action: 'Expired Stock Auto Deducted', quantity: '500 g', direction: 'out', by: 'System' },
  { _id: 'waste', date: '2026-11-03T02:00:00Z', item: 'Beans', movementType: 'waste', action: 'Deducted (Refund Waste)', quantity: '18 g', direction: 'out', reference: 'FLX-OLD', by: 'Staff' },
];
const response = data => Promise.resolve({ ok: true, json: async () => ({ data }) });
beforeEach(() => {
  localStorage.clear(); localStorage.setItem('user', JSON.stringify({ role: 'owner' }));
  global.fetch = jest.fn(url => response(url.endsWith('/inventory-history') ? rows : []));
});
afterEach(() => jest.restoreAllMocks());

test('inventory history distinguishes expired stock from refund waste and shows quantity direction and PO references', async () => {
  render(<HistoryPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Inventory History' }));
  expect(await screen.findByText('PO-TEST-001')).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Expired stock' })).toHaveTextContent('1');
  expect(screen.getByRole('group', { name: 'Refund waste' })).toHaveTextContent('1');
  expect(screen.getByRole('group', { name: 'Stock received' })).toHaveTextContent('1');
  expect(screen.getByText('+1,000 ml')).toBeInTheDocument();
  expect(screen.getByText('−100 ml')).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Inventory movements' })).toHaveClass('data-scroll-box');
});

test('ingredient/reference search, movement filter and Philippine dates can be combined and cleared', () => {
  render(<InventoryHistoryPanel rows={rows} onRefresh={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'po-test' } });
  expect(screen.getByText('Showing 1 of 4 entries')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  fireEvent.change(screen.getByLabelText('Movement'), { target: { value: 'expired' } });
  const table = screen.getByRole('region', { name: 'Inventory movements' });
  expect(within(table).getByText('Cream')).toBeInTheDocument();
  expect(within(table).queryByText('Beans')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-11-05' } });
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-11-05' } });
  expect(screen.getByText('Showing 2 of 4 entries')).toBeInTheDocument(); // Includes 00:30 Manila, still Nov 4 in UTC.
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-11-03' } });
  expect(screen.getByRole('alert')).toHaveTextContent('Start date must be on or before end date');
  expect(screen.getByText('No movements match these filters.')).toBeInTheDocument();
});

test('old API rows without category fields still appear under every matching movement filter and counter', () => {
  const legacy = [
    ['Stock In', 'Sugar', '50 g'], ['Sale Deduction', 'Beans', '18 g'], ['Stock Out', 'Flour', '8 g'],
    ['Expired Stock Auto Deducted', 'corn starch', '1500 g'], ['Deducted (Refund Waste)', 'Cream', '20 g'],
  ].map(([action, item, quantity]) => ({ action, item, quantity, date: '2026-10-19T00:06:00Z', by: 'System' }));
  render(<InventoryHistoryPanel rows={legacy} onRefresh={jest.fn()} />);
  const table = screen.getByRole('region', { name: 'Inventory movements' });
  for (const [type, label, item] of [
    ['received', 'Stock received', 'Sugar'], ['sale', 'Used in sales', 'Beans'], ['adjustment', 'Stock out', 'Flour'],
    ['expired', 'Expired stock', 'corn starch'], ['waste', 'Refund waste', 'Cream'],
  ]) {
    fireEvent.change(screen.getByLabelText('Movement'), { target: { value: type } });
    expect(within(table).getByText(item)).toBeInTheDocument();
    expect(screen.getByText('Showing 1 of 5 entries')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: label })).getByText('1')).toBeInTheDocument();
  }
  fireEvent.change(screen.getByLabelText('Movement'), { target: { value: 'received' } });
  expect(within(table).getByText('+50 g')).toBeInTheDocument();
});

test('refresh reloads movements without clearing the active search', async () => {
  render(<HistoryPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Inventory History' }));
  await screen.findByText('PO-TEST-001');
  fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'milk' } });
  expect(screen.getByText('Showing 2 of 4 entries')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled());
  expect(screen.getByLabelText('Search')).toHaveValue('milk');
  expect(fetch.mock.calls.filter(([url]) => url.endsWith('/inventory-history'))).toHaveLength(2);
});

test('failed history requests display the server error rather than an empty movement list', async () => {
  fetch.mockImplementation(url => url.endsWith('/inventory-history')
    ? Promise.resolve({ ok: false, json: async () => ({ message: 'Could not load inventory history.' }) }) : response([]));
  jest.spyOn(console, 'error').mockImplementation(() => {});
  render(<HistoryPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Inventory History' }));
  expect(await screen.findByText('Could not load inventory history.')).toBeInTheDocument();
  expect(screen.queryByText('No inventory movements recorded yet.')).not.toBeInTheDocument();
});
