import { buildReportCsvRows, REPORT_CSV_OPTIONS } from './reportCsv';
import { rowsToCsv } from './csv';

const data = {
  report: { salesTransactions: [{ receiptNo: 'SALE-1', total: 100, createdAt: '2026-11-07T08:00:00+08:00' }], cancelledTransactions: [{ receiptNo: 'CANCELLED-1' }],
    grossSales: 100, refundTotal: 20, netSales: 80, discounts: 0, tax: 0, pendingRefundTotal: 0,
    paymentRows: [{ method: 'Cash', orders: 1, gross: 100 }], productRows: [{ name: 'Sold Coffee', quantity: 1, gross: 100 }] },
  inventory: [{ name: 'Inventory Beans', stock: 10, unit: 'g', lowStockAt: 5 }],
  inventoryHistory: [{ item: 'Moved Beans', amount: -5, unit: 'g', quantity: '-5 g' }],
  refunds: [{ _id: 'refund-1', receiptNo: 'REFUND-1', totalRefunded: 20, status: 'approved' }],
  systemAudit: [{ module: 'Staff', action: 'Created', entityName: 'Audit User', actor: '=SUM(A1)', details: 'Comma, newline\nand "quotes"' }],
  loginActivity: [{ name: 'Login User', role: 'staff', action: 'logout' }],
};

test.each(REPORT_CSV_OPTIONS)('%s exports one rectangular table with consistent columns', type => {
  const rows = buildReportCsvRows(type, data);
  expect(rows.length).toBeGreaterThan(1);
  expect(rows.every(row => row.length === rows[0].length)).toBe(true);
});
test('sales exports exclude cancelled checkouts, inventory and audit records and retain explicit timestamps', () => {
  const csv = rowsToCsv(buildReportCsvRows('sales_transactions', data));
  expect(csv).toContain('SALE-1');
  expect(csv).toContain('2026-11-07 08:00:00');
  for (const excluded of ['CANCELLED-1', 'Inventory Beans', 'Audit User', 'Login User']) expect(csv).not.toContain(excluded);
});
test('activity exports include only system changes and keep CSV escaping and formula protection', () => {
  const csv = rowsToCsv(buildReportCsvRows('activity_logs', data));
  expect(csv).toContain('User Accounts');
  expect(csv).toContain("'" + '=SUM(A1)');
  expect(csv).toContain('""quotes""');
  expect(csv).not.toContain('SALE-1');
  expect(csv).not.toContain('Login User');
});
test('inventory movements export numeric amounts with a separate unit', () => {
  const rows = buildReportCsvRows('inventory_movements', data);
  expect(rows[1].slice(3, 5)).toEqual([-5, 'g']);
});
test('an empty record category retains its headers, and unknown categories are rejected', () => {
  expect(buildReportCsvRows('login_activity', { ...data, loginActivity: [] })).toHaveLength(1);
  expect(() => buildReportCsvRows('mixed', data)).toThrow('Select a valid CSV record type');
});

test('off-shift login CSV preserves status and the schedule snapshot, while archived attempts retain their label', () => {
  const rows = buildReportCsvRows('login_activity', { ...data, loginActivity: [
    { action: 'login_blocked_off_shift', shiftSchedule: { workdays: ['monday'], startTime: '22:00', endTime: '06:00', earlyLoginMinutes: 15 } },
    { action: 'login_blocked_archived' }, { action: 'login' }, { action: 'logout' },
  ] });
  expect(rows.map(row => row[5]).slice(1)).toEqual(['Blocked — Outside shift', 'Blocked — Archived account', 'Signed in', 'Signed out']);
  expect(rows[1][7]).toContain('Mon · 10:00 PM–6:00 AM (+1 day) · PHT');
  expect(rows[1][7]).toContain('Early login allowance: 15 minutes');
});
