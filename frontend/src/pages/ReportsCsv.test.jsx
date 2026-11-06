import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import ReportsPage from './ReportsPage';

jest.mock('axios');
jest.mock('../components/Sidebar', () => () => null);
beforeEach(() => {
  jest.resetAllMocks();
  URL.createObjectURL = jest.fn(() => 'blob:csv');
  URL.revokeObjectURL = jest.fn();
  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  axios.get.mockImplementation(url => Promise.resolve({ data: url.includes('/login-activity') ? { data: [
    { name: 'Staff Person', role: 'staff', email: 'staff@example.com' }, { name: 'Owner Person', role: 'owner', email: 'owner@example.com' },
  ] } : url.includes('/transactions') ? { data: [{ receiptNo: 'SALE-1', total: 100, items: [] }] } : url.endsWith('/inventory') ? [{ name: 'Beans', stock: 10 }] : { data: [] } }));
});
afterEach(() => jest.restoreAllMocks());
const readDownload = () => new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(URL.createObjectURL.mock.calls[0][0]); });

test('CSV chooser downloads one selected category with a specific filename', async () => {
  render(<ReportsPage />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
  fireEvent.change(screen.getByLabelText('Record category'), { target: { value: 'inventory' } });
  expect(screen.getByText(/This shows stock now/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
  await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
  const csv = await readDownload();
  expect(csv).toContain('Beans');
  expect(csv).not.toContain('SALE-1');
  expect(HTMLAnchorElement.prototype.click.mock.instances[0].download).toMatch(/^flux-inventory-current-.*\.csv$/);
});
test('login CSV honors the current search and role filters', async () => {
  render(<ReportsPage />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Activity Logs' }));
  fireEvent.change(screen.getByPlaceholderText('Search name, email, staff ID, or role...'), { target: { value: 'Staff' } });
  fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
  fireEvent.change(screen.getByLabelText('Record category'), { target: { value: 'login_activity' } });
  fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
  await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
  const csv = await readDownload();
  expect(csv).toContain('Staff Person');
  expect(csv).not.toContain('Owner Person');
  expect(csv).not.toContain('SALE-1');
});

test('a specific day selected inside the export dialog fetches that day instead of the page data', async () => {
  const oct3 = { receiptNo: 'OCT-3', total: 50, createdAt: '2026-10-03T10:00:00+08:00', items: [] };
  axios.get.mockImplementation(url => Promise.resolve({ data: url.includes('/transactions') ? { data: new URL(url).searchParams.get('startDate') === '2026-10-03T00:00:00+08:00' ? [oct3] : [{ receiptNo: 'TODAY', total: 100, items: [] }] } : url.endsWith('/inventory') ? [] : { data: [] } }));
  render(<ReportsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
  fireEvent.click(screen.getByRole('button', { name: 'Single day' }));
  fireEvent.change(screen.getByLabelText('Report date'), { target: { value: '2026-10-03' } });
  fireEvent.click(screen.getByRole('button', { name: 'Preview report' }));
  expect(await screen.findByRole('region', { name: 'CSV preview' })).toHaveTextContent('OCT-3');
  expect(screen.getByRole('region', { name: 'CSV preview' })).not.toHaveTextContent('TODAY');
  fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
  await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
  const csv = await readDownload();
  expect(csv).toContain('OCT-3');
  expect(csv).toContain('2026-10-03 10:00:00');
  expect(csv).not.toContain('TODAY');
  expect(HTMLAnchorElement.prototype.click.mock.instances[0].download).toBe('flux-sales-transactions-2026-10-03.csv');
});
