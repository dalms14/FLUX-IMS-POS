import axios from 'axios';
import { buildReportCsvRows, REPORT_CSV_OPTIONS } from './reportCsv';

export const manilaToday = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export function csvPeriod(mode, start, end) {
  if (mode === 'all') return { start: '', end: '' };
  if (!validDate(start)) throw new Error(mode === 'day' ? 'Select a report date.' : 'Select a valid start date.');
  if (mode === 'day') return { start, end: start };
  if (!validDate(end)) throw new Error('Select a valid end date.');
  if (end < start) throw new Error('End date must be on or after the start date.');
  return { start, end };
}

const records = response => {
  const rows = Array.isArray(response.data) ? response.data : response.data?.data;
  if (!Array.isArray(rows)) throw new Error('The report returned an unreadable response. Please try again.');
  return rows;
};
const cancelled = row => row.orderStatus === 'cancelled' || row.paymentMethod === 'Cancelled';
const amount = value => Number(value) || 0;

function summaries(transactions, refunds) {
  const salesTransactions = transactions.filter(row => !cancelled(row));
  const cancelledTransactions = transactions.filter(cancelled);
  const sum = key => salesTransactions.reduce((total, row) => total + amount(row[key]), 0);
  const grossSales = sum('total');
  const refundTotal = refunds.filter(row => ['approved', 'completed'].includes(row.status)).reduce((total, row) => total + amount(row.totalRefunded), 0);
  const paymentMap = new Map(), productMap = new Map();
  for (const sale of salesTransactions) {
    const method = sale.paymentMethod || 'Unknown';
    const payment = paymentMap.get(method) || { method, orders: 0, gross: 0, amountTendered: 0, change: 0 };
    payment.orders += 1; payment.gross += amount(sale.total); payment.amountTendered += amount(sale.amountTendered); payment.change += amount(sale.change);
    paymentMap.set(method, payment);
    for (const item of sale.items || []) {
      const key = String(item.productId?._id || item.productId || item.name);
      const product = productMap.get(key) || { name: item.name || 'Unknown item', category: item.category || 'Uncategorized', quantity: 0, gross: 0 };
      product.quantity += amount(item.quantity);
      product.gross += amount(item.subtotal || amount(item.price) * amount(item.quantity));
      productMap.set(key, product);
    }
  }
  return { salesTransactions, cancelledTransactions, grossSales, refundTotal, netSales: grossSales - refundTotal,
    discounts: sum('discount'), tax: sum('tax'),
    pendingRefundTotal: refunds.filter(row => row.status === 'pending').reduce((total, row) => total + amount(row.totalRefunded), 0),
    paymentRows: [...paymentMap.values()].sort((a, b) => b.gross - a.gross), productRows: [...productMap.values()].sort((a, b) => b.gross - a.gross) };
}

export async function loadReportCsv({ type, mode, startDate, endDate, loginQuery = '', loginRole = 'all', signal }) {
  if (!REPORT_CSV_OPTIONS.some(([key]) => key === type)) throw new Error('Select a valid record category.');
  const snapshot = type === 'inventory';
  const period = snapshot ? { start: '', end: '' } : csvPeriod(mode, startDate, endDate);
  const params = new URLSearchParams();
  if (period.start) params.set('startDate', `${period.start}T00:00:00+08:00`);
  if (period.end) params.set('endDate', `${period.end}T23:59:59.999+08:00`);
  const query = params.toString();
  const get = async path => records(await axios.get(`http://localhost:5000/api/${path}${!snapshot && query ? `?${query}` : ''}`, { signal }));
  // Log screens are capped at 500 records. Read every page for the selected export.
  const getLogs = async path => {
    const all = [];
    const logParams = new URLSearchParams(query);
    if (!period.end) logParams.set('endDate', new Date().toISOString());
    let hasMore = true;
    for (let page = 1; hasMore; page += 1) {
      logParams.set('page', page);
      const response = await axios.get(`http://localhost:5000/api/${path}?${logParams}`, { signal });
      all.push(...records(response));
      hasMore = response.data?.hasMore === true;
    }
    return all;
  };
  const data = { inventory: [], inventoryHistory: [], refunds: [], systemAudit: [], loginActivity: [] };
  let transactions = [];
  switch (type) {
    case 'inventory': data.inventory = await get('inventory'); break;
    case 'inventory_movements': data.inventoryHistory = await get('inventory-history'); break;
    case 'activity_logs': data.systemAudit = await getLogs('system-audit'); break;
    case 'login_activity': {
      const query = loginQuery.trim().toLowerCase();
      data.loginActivity = (await getLogs('auth/login-activity')).filter(row => {
        const status = row.action === 'logout' ? 'Signed out' : row.action === 'login_blocked_archived' ? 'Blocked — Archived account' : 'Signed in';
        return (loginRole === 'all' || String(row.role || '').toLowerCase() === loginRole)
          && (!query || [row.name, row.email, row.staffId, row.role, status].some(value => String(value || '').toLowerCase().includes(query)));
      });
      break;
    }
    case 'refunds': data.refunds = await get('refunds'); break;
    case 'financial_summary': [transactions, data.refunds] = await Promise.all([get('transactions'), get('refunds')]); break;
    default: transactions = await get('transactions');
  }
  data.report = summaries(transactions, data.refunds);
  const rows = buildReportCsvRows(type, data);
  const suffix = snapshot ? `current-${manilaToday()}` : !period.start ? 'all-time'
    : period.start === period.end ? period.start : `${period.start}-to-${period.end}`;
  return { rows, filename: `flux-${type.replace(/_/g, '-')}-${suffix}.csv`, rowCount: rows.length - 1, period };
}
