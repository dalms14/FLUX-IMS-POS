import axios from 'axios';
import { csvPeriod, loadReportCsv } from './loadReportCsv';

jest.mock('axios');
beforeEach(() => jest.resetAllMocks());
const options = { type: 'sales_transactions', mode: 'day', startDate: '2026-10-03', endDate: '' };

test('one-day exports request inclusive Philippine day boundaries', async () => {
  axios.get.mockResolvedValue({ data: { data: [{ receiptNo: 'OCT-3', createdAt: '2026-10-02T16:00:00Z', total: 100 }] } });
  const result = await loadReportCsv(options);
  const url = new URL(axios.get.mock.calls[0][0]);
  expect(url.searchParams.get('startDate')).toBe('2026-10-03T00:00:00+08:00');
  expect(url.searchParams.get('endDate')).toBe('2026-10-03T23:59:59.999+08:00');
  expect(result.rows[1][2]).toBe('2026-10-03 00:00:00');
  expect(result.filename).toBe('flux-sales-transactions-2026-10-03.csv');
});
test('date range filenames and filters use the selected start and end', async () => {
  axios.get.mockResolvedValue({ data: { data: [] } });
  const result = await loadReportCsv({ ...options, mode: 'range', endDate: '2026-10-07' });
  const url = new URL(axios.get.mock.calls[0][0]);
  expect(url.searchParams.get('endDate')).toBe('2026-10-07T23:59:59.999+08:00');
  expect(result.filename).toContain('2026-10-03-to-2026-10-07');
  expect(result.rowCount).toBe(0);
});
test('financial summaries use freshly loaded sales and refunds for the chosen period', async () => {
  axios.get.mockImplementation(url => Promise.resolve({ data: { data: url.includes('/transactions') ? [
    { total: 150, discount: 10, tax: 0, paymentMethod: 'Cash' }, { total: 50, paymentMethod: 'Cancelled' },
  ] : [{ status: 'approved', totalRefunded: 20 }, { status: 'pending', totalRefunded: 5 }] } }));
  const result = await loadReportCsv({ ...options, type: 'financial_summary' });
  expect(result.rows[1]).toEqual([150, 20, 130, 10, 0, 5, 1, 1]);
  expect(axios.get).toHaveBeenCalledTimes(2);
});
test('current inventory is fetched as a snapshot without misleading historical filters', async () => {
  axios.get.mockResolvedValue({ data: [{ name: 'Beans', stock: 20, unit: 'g' }] });
  const result = await loadReportCsv({ ...options, type: 'inventory' });
  expect(axios.get.mock.calls[0][0]).toBe('http://localhost:5000/api/inventory');
  expect(result.filename).toMatch(/^flux-inventory-current-\d{4}-\d{2}-\d{2}\.csv$/);
});
test('log export reads all pages and then applies search and role filters', async () => {
  axios.get.mockImplementation(url => Promise.resolve({ data: { hasMore: new URL(url).searchParams.get('page') === '1', data: new URL(url).searchParams.get('page') === '1'
    ? [{ name: 'Other User', role: 'owner' }] : [{ name: 'Member Clerk', role: 'staff' }] } }));
  const result = await loadReportCsv({ ...options, type: 'login_activity', loginQuery: 'clerk', loginRole: 'staff' });
  expect(axios.get).toHaveBeenCalledTimes(2);
  expect(result.rowCount).toBe(1);
  expect(result.rows[1][1]).toBe('Member Clerk');
});
test('missing, impossible and reversed dates are rejected before requests', async () => {
  for (const change of [{ startDate: '' }, { startDate: '2026-02-30' }, { mode: 'range', endDate: '' }, { mode: 'range', endDate: '2026-10-02' }]) {
    await expect(loadReportCsv({ ...options, ...change })).rejects.toThrow();
  }
  expect(axios.get).not.toHaveBeenCalled();
  expect(csvPeriod('all', '', '')).toEqual({ start: '', end: '' });
});
