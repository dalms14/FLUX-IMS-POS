import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import {
  FiArchive,
  FiBarChart2,
  FiDownload,
  FiDollarSign,
  FiFileText,
  FiLogIn,
  FiRefreshCw,
  FiShoppingBag,
} from 'react-icons/fi';

const today = new Date();
const toDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const toManilaStart = (dateString) => `${dateString}T00:00:00+08:00`;
const toManilaEnd = (dateString) => `${dateString}T23:59:59.999+08:00`;
const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

const presets = {
  today: { label: 'Today', start: toDateInput(today), end: toDateInput(today) },
  month: { label: 'This Month', start: toDateInput(startOfMonth), end: toDateInput(today) },
  all: { label: 'All Time', start: '', end: '' },
};

const money = (value) => `PHP ${(Number(value) || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
const isCancelledTransaction = (transaction) => transaction?.orderStatus === 'cancelled' || transaction?.paymentMethod === 'Cancelled';

const cardStyle = {
  backgroundColor: '#fff',
  border: '1px solid #E0D5CB',
  borderRadius: '8px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
};

const thStyle = {
  padding: '11px 12px',
  textAlign: 'left',
  fontSize: '10px',
  fontWeight: '900',
  color: '#6F4A2F',
  textTransform: 'uppercase',
  letterSpacing: '0.7px',
  borderBottom: '2px solid #E0D5CB',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '11px 12px',
  fontSize: '12px',
  color: '#333',
  borderBottom: '1px solid #F0E8E0',
  verticalAlign: 'top',
};

const Section = ({ title, action, children }) => (
  <section style={{ ...cardStyle, overflow: 'hidden' }}>
    <div style={{ padding: '15px 16px', borderBottom: '1px solid #E0D5CB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: '#1a1a1a' }}>{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

const MetricCard = ({ title, value, detail, icon, color }) => (
  <div style={{ ...cardStyle, padding: '16px' }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: '0 0 7px', fontSize: '10px', color: '#777', textTransform: 'uppercase', fontWeight: '900', letterSpacing: '0.7px' }}>{title}</p>
        <p style={{ margin: 0, fontSize: '23px', color, fontWeight: '900', lineHeight: 1.05 }}>{value}</p>
      </div>
      <div style={{ width: '38px', height: '38px', borderRadius: '8px', backgroundColor: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
        {icon}
      </div>
    </div>
    {detail && <p style={{ margin: '9px 0 0', fontSize: '11px', color: '#999', lineHeight: 1.35 }}>{detail}</p>}
  </div>
);

const DataTable = ({ headers, rows, emptyText, renderRow }) => (
  <div style={{ overflow: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>{headers.map(header => <th key={header} style={thStyle}>{header}</th>)}</tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={headers.length} style={{ ...tdStyle, textAlign: 'center', color: '#999', padding: '28px' }}>{emptyText}</td></tr>
        ) : rows.map(renderRow)}
      </tbody>
    </table>
  </div>
);

const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const rowsToCsv = (rows) => rows.map(row => row.map(csvEscape).join(',')).join('\n');

const downloadBlob = (content, filename, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const displayAuditModule = (module) => module === 'Staff' ? 'User Accounts' : module;

const ReportsPage = () => {
  const [preset, setPreset] = useState('today');
  const [startDate, setStartDate] = useState(presets.today.start);
  const [endDate, setEndDate] = useState(presets.today.end);
  const [transactions, setTransactions] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [inventoryHistory, setInventoryHistory] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);
  const [loginActivity, setLoginActivity] = useState([]);
  const [systemAudit, setSystemAudit] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', toManilaStart(startDate));
    if (endDate) params.append('endDate', toManilaEnd(endDate));
    return params.toString();
  }, [startDate, endDate]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const query = buildQuery();
      const [transactionRes, refundRes, inventoryRes, inventoryHistoryRes, salesHistoryRes, loginActivityRes, systemAuditRes] = await Promise.all([
        axios.get(`http://localhost:5000/api/transactions${query ? `?${query}` : ''}`),
        axios.get(`http://localhost:5000/api/refunds${query ? `?${query}` : ''}`),
        axios.get('http://localhost:5000/api/inventory'),
        axios.get(`http://localhost:5000/api/inventory-history${query ? `?${query}` : ''}`),
        axios.get(`http://localhost:5000/api/sales-history${query ? `?${query}` : ''}`),
        axios.get(`http://localhost:5000/api/auth/login-activity${query ? `?${query}` : ''}`),
        axios.get(`http://localhost:5000/api/system-audit${query ? `?${query}` : ''}`),
      ]);

      setTransactions(transactionRes.data.data || transactionRes.data || []);
      setRefunds(refundRes.data.data || refundRes.data || []);
      setInventory(inventoryRes.data || []);
      setInventoryHistory(inventoryHistoryRes.data.data || []);
      setSalesHistory(salesHistoryRes.data.data || []);
      setLoginActivity(loginActivityRes.data.data || []);
      setSystemAudit(systemAuditRes.data.data || []);
    } catch (err) {
      console.error('Error loading reports:', err);
      setError('Failed to load reports. Please check the backend connection.');
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) fetchReports();
    };

    const handleWindowFocus = () => fetchReports();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [fetchReports]);

  const report = useMemo(() => {
    const activeRefunds = refunds.filter(refund => ['approved', 'completed'].includes(refund.status));
    const pendingRefunds = refunds.filter(refund => refund.status === 'pending');
    const rejectedRefunds = refunds.filter(refund => refund.status === 'rejected');
    const cancelledTransactions = transactions.filter(isCancelledTransaction);
    const salesTransactions = transactions.filter(transaction => !isCancelledTransaction(transaction));

    const grossSales = salesTransactions.reduce((sum, transaction) => sum + (transaction.total || 0), 0);
    const subtotal = salesTransactions.reduce((sum, transaction) => sum + (transaction.subtotal || 0), 0);
    const discounts = salesTransactions.reduce((sum, transaction) => sum + (transaction.discount || 0), 0);
    const tax = salesTransactions.reduce((sum, transaction) => sum + (transaction.tax || 0), 0);
    const refundTotal = activeRefunds.reduce((sum, refund) => sum + (refund.totalRefunded || 0), 0);
    const pendingRefundTotal = pendingRefunds.reduce((sum, refund) => sum + (refund.totalRefunded || 0), 0);
    const netSales = grossSales - refundTotal;
    const itemCount = salesTransactions.reduce((sum, transaction) => (
      sum + (transaction.items || []).reduce((itemSum, item) => itemSum + (item.quantity || 0), 0)
    ), 0);

    const paymentRows = Array.from(salesTransactions.reduce((map, transaction) => {
      const method = transaction.paymentMethod || 'Unknown';
      const current = map.get(method) || { method, orders: 0, gross: 0, amountTendered: 0, change: 0 };
      current.orders += 1;
      current.gross += transaction.total || 0;
      current.amountTendered += transaction.amountTendered || 0;
      current.change += transaction.change || 0;
      map.set(method, current);
      return map;
    }, new Map()).values()).sort((a, b) => b.gross - a.gross);

    const productRows = Array.from(salesTransactions.reduce((map, transaction) => {
      (transaction.items || []).forEach(item => {
        const key = String(item.productId?._id || item.productId || item.name);
        const current = map.get(key) || {
          key,
          name: item.name || 'Unknown item',
          category: item.category || 'Uncategorized',
          quantity: 0,
          gross: 0,
        };
        current.quantity += item.quantity || 0;
        current.gross += item.subtotal || ((item.price || 0) * (item.quantity || 0));
        map.set(key, current);
      });
      return map;
    }, new Map()).values()).sort((a, b) => b.gross - a.gross);

    const cashierRows = Array.from(salesTransactions.reduce((map, transaction) => {
      const cashier = transaction.cashier || 'Unknown';
      const current = map.get(cashier) || { cashier, orders: 0, gross: 0, itemCount: 0 };
      current.orders += 1;
      current.gross += transaction.total || 0;
      current.itemCount += (transaction.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
      map.set(cashier, current);
      return map;
    }, new Map()).values()).sort((a, b) => b.gross - a.gross);

    const customerRows = Array.from(salesTransactions.reduce((map, transaction) => {
      const type = transaction.customerType || 'customer';
      const current = map.get(type) || { type, orders: 0, gross: 0, discounts: 0 };
      current.orders += 1;
      current.gross += transaction.total || 0;
      current.discounts += transaction.discount || 0;
      map.set(type, current);
      return map;
    }, new Map()).values()).sort((a, b) => b.gross - a.gross);

    const lowStockRows = inventory
      .filter(item => (item.stock || 0) <= (item.lowStockAt || 0))
      .sort((a, b) => (a.stock || 0) - (b.stock || 0));

    const inventoryCategoryRows = Array.from(inventory.reduce((map, item) => {
      const category = item.category || 'General';
      const current = map.get(category) || { category, items: 0, stock: 0, low: 0, out: 0 };
      current.items += 1;
      current.stock += item.stock || 0;
      if ((item.stock || 0) <= (item.lowStockAt || 0)) current.low += 1;
      if ((item.stock || 0) === 0) current.out += 1;
      map.set(category, current);
      return map;
    }, new Map()).values()).sort((a, b) => a.category.localeCompare(b.category));

    const activityRows = [
      ...transactions.map(transaction => ({
        date: transaction.createdAt,
        type: isCancelledTransaction(transaction) ? 'Cancelled Checkout' : 'Sale',
        reference: transaction.receiptNo,
        actor: transaction.cashier,
        detail: isCancelledTransaction(transaction)
          ? transaction.cancelReason || `${(transaction.items || []).length} line item(s), cancelled before payment`
          : `${(transaction.items || []).length} line item(s), ${transaction.paymentMethod}`,
        amount: isCancelledTransaction(transaction) ? 0 : transaction.total || 0,
      })),
      ...refunds.map(refund => ({
        date: refund.createdAt,
        type: `Refund ${refund.status || ''}`.trim(),
        reference: refund.receiptNo,
        actor: refund.refundedBy,
        detail: refund.reason || `${(refund.items || []).length} refunded item(s)`,
        amount: -(refund.totalRefunded || 0),
      })),
      ...inventoryHistory.map(row => ({
        date: row.date,
        type: 'Inventory',
        reference: row.action,
        actor: row.by,
        detail: `${row.item}: ${row.quantity} (${row.reason || 'No reason'})`,
        amount: '',
      })),
      ...loginActivity.map(row => ({
        date: row.createdAt,
        type: 'Login',
        reference: row.staffId || row.email,
        actor: row.name,
        detail: `${row.role} signed in`,
        amount: '',
      })),
      ...systemAudit.map(row => ({
        date: row.createdAt,
        type: 'System Change',
        reference: `${displayAuditModule(row.module)} / ${row.action}`,
        actor: row.actor,
        detail: [
          row.entityName || row.entityId || '-',
          row.details,
          row.changes?.email ? `Email: ${row.changes.email}` : '',
          row.changes?.userId ? `User ID: ${row.changes.userId}` : '',
        ].filter(Boolean).join(' - '),
        amount: '',
      })),
    ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    return {
      activeRefunds,
      pendingRefunds,
      rejectedRefunds,
      cancelledTransactions,
      salesTransactions,
      grossSales,
      subtotal,
      discounts,
      tax,
      refundTotal,
      pendingRefundTotal,
      netSales,
      itemCount,
      paymentRows,
      productRows,
      cashierRows,
      customerRows,
      lowStockRows,
      inventoryCategoryRows,
      activityRows,
    };
  }, [transactions, refunds, inventory, inventoryHistory, loginActivity, systemAudit]);

  const applyPreset = (key) => {
    setPreset(key);
    setStartDate(presets[key].start);
    setEndDate(presets[key].end);
  };

  const exportCsv = () => {
    const rows = [
      ['FLUX Reports'],
      ['Period', startDate || 'All', endDate || 'All'],
      [],
      ['Financial Summary'],
      ['Gross Sales', report.grossSales],
      ['Approved/Completed Refunds', report.refundTotal],
      ['Net Sales', report.netSales],
      ['Cancelled Checkouts', report.cancelledTransactions.length],
      ['Discounts', report.discounts],
      ['Tax', report.tax],
      ['Pending Refund Value', report.pendingRefundTotal],
      [],
      ['Payment Method', 'Orders', 'Gross Sales', 'Amount Tendered', 'Change'],
      ...report.paymentRows.map(row => [row.method, row.orders, row.gross, row.amountTendered, row.change]),
      [],
      ['Product', 'Category', 'Qty Sold', 'Gross Sales'],
      ...report.productRows.map(row => [row.name, row.category, row.quantity, row.gross]),
      [],
      ['Inventory Item', 'Category', 'Stock', 'Unit', 'Low Stock At', 'Status'],
      ...inventory.map(item => [
        item.name,
        item.category || 'General',
        item.stock,
        item.unit,
        item.lowStockAt,
        (item.stock || 0) === 0 ? 'Out of Stock' : (item.stock || 0) <= (item.lowStockAt || 0) ? 'Low Stock' : 'In Stock',
      ]),
      [],
      ['Activity Date', 'Type', 'Reference', 'Actor', 'Detail', 'Amount'],
      ...report.activityRows.map(row => [formatDateTime(row.date), row.type, row.reference, row.actor, row.detail, row.amount]),
      [],
      ['Login Time', 'Name', 'Email', 'Role', 'Staff ID', 'Device'],
      ...loginActivity.map(row => [formatDateTime(row.createdAt), row.name, row.email, row.role, row.staffId, row.userAgent]),
      [],
      ['System Change Time', 'Module', 'Action', 'Record', 'Actor', 'Details'],
      ...systemAudit.map(row => [formatDateTime(row.createdAt), row.module, row.action, row.entityName || row.entityId, row.actor, row.details]),
    ];

    downloadBlob(rowsToCsv(rows), `flux-reports-${startDate || 'all'}-${endDate || 'all'}.csv`, 'text/csv;charset=utf-8;');
  };

  const exportJson = () => {
    const payload = {
      app: 'FLUX POS',
      reportType: 'Sales, Inventory, and Finance Reports',
      period: { startDate: startDate || null, endDate: endDate || null },
      generatedAt: new Date().toISOString(),
      summary: {
        grossSales: report.grossSales,
        refunds: report.refundTotal,
        netSales: report.netSales,
        discounts: report.discounts,
        tax: report.tax,
        orders: report.salesTransactions.length,
        cancelledCheckouts: report.cancelledTransactions.length,
        itemCount: report.itemCount,
        inventoryItems: inventory.length,
        lowStockItems: report.lowStockRows.length,
      },
      transactions,
      refunds,
      inventory,
      inventoryHistory,
      salesHistory,
      loginActivity,
      systemAudit,
      computed: report,
    };

    downloadBlob(JSON.stringify(payload, null, 2), `flux-reports-${startDate || 'all'}-${endDate || 'all'}.json`, 'application/json;charset=utf-8;');
  };

  return (
    <div className="mobile-app-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#F5F0EB' }}>
      <Sidebar />

      <main className="mobile-page-content" style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
        <PageHeader
          title="Reports"
          description="Sales, inventory, finance, and activity records."
          actions={
            <>
            <button onClick={exportCsv} disabled={loading} style={{ padding: '10px 13px', border: 'none', borderRadius: '8px', backgroundColor: loading ? '#bbb' : '#1A1208', color: '#fff', fontWeight: '800', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiDownload size={15} /> Export CSV
            </button>
            <button onClick={exportJson} disabled={loading} style={{ padding: '10px 13px', border: '1px solid #8B5E3C', borderRadius: '8px', backgroundColor: '#fff', color: '#8B5E3C', fontWeight: '800', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiFileText size={15} /> Export JSON
            </button>
            </>
          }
        />

        <section style={{ ...cardStyle, padding: '16px', marginBottom: '18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '7px', fontSize: '11px', color: '#666', fontWeight: '900', textTransform: 'uppercase' }}>Preset</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {Object.entries(presets).map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() => applyPreset(key)}
                    style={{ padding: '9px 12px', borderRadius: '7px', border: '1px solid #D4B89A', backgroundColor: preset === key ? '#8B5E3C' : '#fff', color: preset === key ? '#fff' : '#6F4A2F', fontSize: '12px', fontWeight: '900', cursor: 'pointer' }}
                  >
                    {value.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '7px', fontSize: '11px', color: '#666', fontWeight: '900', textTransform: 'uppercase' }}>Start Date</label>
              <input type="date" value={startDate} onChange={e => { setPreset('custom'); setStartDate(e.target.value); }} style={{ width: '100%', padding: '10px', border: '1px solid #D4B89A', borderRadius: '7px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '7px', fontSize: '11px', color: '#666', fontWeight: '900', textTransform: 'uppercase' }}>End Date</label>
              <input type="date" value={endDate} onChange={e => { setPreset('custom'); setEndDate(e.target.value); }} style={{ width: '100%', padding: '10px', border: '1px solid #D4B89A', borderRadius: '7px', boxSizing: 'border-box' }} />
            </div>
            <button onClick={fetchReports} disabled={loading} style={{ padding: '11px 14px', borderRadius: '8px', border: 'none', backgroundColor: '#8B5E3C', color: '#fff', fontWeight: '900', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <FiRefreshCw size={15} /> {loading ? 'Loading' : 'Apply'}
            </button>
          </div>
        </section>

        {error && <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#FFF5F5', color: '#C53030', border: '1px solid #FED7D7', borderRadius: '8px', fontSize: '13px', fontWeight: '800' }}>{error}</div>}

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))', gap: '14px', marginBottom: '18px' }}>
          <MetricCard title="Net Sales" value={money(report.netSales)} detail={`${money(report.grossSales)} gross minus ${money(report.refundTotal)} refunds`} icon={<FiDollarSign size={21} />} color="#276749" />
          <MetricCard title="Orders" value={report.salesTransactions.length.toLocaleString()} detail={`${report.itemCount.toLocaleString()} total items sold`} icon={<FiShoppingBag size={21} />} color="#8B5E3C" />
          <MetricCard title="Finance Flow" value={money(report.grossSales)} detail={`${money(report.discounts)} discounts, ${money(report.tax)} tax`} icon={<FiBarChart2 size={21} />} color="#2B6CB0" />
          <MetricCard title="Cancelled Checkouts" value={report.cancelledTransactions.length.toLocaleString()} detail="Recorded from checkout summary cancel" icon={<FiFileText size={21} />} color="#C53030" />
          <MetricCard title="Inventory Alerts" value={report.lowStockRows.length.toLocaleString()} detail={`${inventory.length.toLocaleString()} total ingredients monitored`} icon={<FiArchive size={21} />} color="#C53030" />
          <MetricCard title="Logins" value={loginActivity.length.toLocaleString()} detail="Owner and staff sign-ins in this period" icon={<FiLogIn size={21} />} color="#6B46C1" />
          <MetricCard title="System Changes" value={systemAudit.length.toLocaleString()} detail="Menu, inventory, staff, recipe, and refund changes" icon={<FiFileText size={21} />} color="#2C5282" />
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)', gap: '18px', marginBottom: '18px' }}>
          <Section title="Financial Report">
            <DataTable
              headers={['Metric', 'Value']}
              rows={[
                ['Subtotal', money(report.subtotal)],
                ['Discounts Given', money(report.discounts)],
                ['Tax Recorded', money(report.tax)],
                ['Gross Sales', money(report.grossSales)],
                ['Approved/Completed Refunds', money(report.refundTotal)],
                ['Pending Refund Value', money(report.pendingRefundTotal)],
                ['Cancelled Checkouts', report.cancelledTransactions.length.toLocaleString()],
                ['Net Sales', money(report.netSales)],
              ]}
              emptyText="No finance data."
              renderRow={(row, index) => (
                <tr key={row[0]} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                  <td style={{ ...tdStyle, fontWeight: '900', color: '#1a1a1a' }}>{row[0]}</td>
                  <td style={{ ...tdStyle, color: row[0] === 'Net Sales' ? '#276749' : row[0] === 'Cancelled Checkouts' ? '#C53030' : '#8B5E3C', fontWeight: '900' }}>{row[1]}</td>
                </tr>
              )}
            />
          </Section>

          <Section title="Payment Methods">
            <DataTable
              headers={['Method', 'Orders', 'Gross', 'Tendered', 'Change']}
              rows={report.paymentRows}
              emptyText="No payment records for this period."
              renderRow={(row, index) => (
                <tr key={row.method} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                  <td style={{ ...tdStyle, fontWeight: '900' }}>{row.method}</td>
                  <td style={tdStyle}>{row.orders}</td>
                  <td style={{ ...tdStyle, color: '#8B5E3C', fontWeight: '900' }}>{money(row.gross)}</td>
                  <td style={tdStyle}>{money(row.amountTendered)}</td>
                  <td style={tdStyle}>{money(row.change)}</td>
                </tr>
              )}
            />
          </Section>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', gap: '18px', marginBottom: '18px' }}>
          <Section title="Sales Report By Product">
            <DataTable
              headers={['Product', 'Category', 'Qty Sold', 'Gross Sales']}
              rows={report.productRows}
              emptyText="No product sales for this period."
              renderRow={(row, index) => (
                <tr key={row.key} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                  <td style={{ ...tdStyle, fontWeight: '900', color: '#1a1a1a' }}>{row.name}</td>
                  <td style={tdStyle}>{row.category}</td>
                  <td style={tdStyle}>{row.quantity.toLocaleString()}</td>
                  <td style={{ ...tdStyle, color: '#8B5E3C', fontWeight: '900' }}>{money(row.gross)}</td>
                </tr>
              )}
            />
          </Section>

          <Section title="Cashier Report">
            <DataTable
              headers={['Cashier', 'Orders', 'Items', 'Gross']}
              rows={report.cashierRows}
              emptyText="No cashier activity for this period."
              renderRow={(row, index) => (
                <tr key={row.cashier} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                  <td style={{ ...tdStyle, fontWeight: '900' }}>{row.cashier}</td>
                  <td style={tdStyle}>{row.orders}</td>
                  <td style={tdStyle}>{row.itemCount}</td>
                  <td style={{ ...tdStyle, color: '#8B5E3C', fontWeight: '900' }}>{money(row.gross)}</td>
                </tr>
              )}
            />
          </Section>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '18px', marginBottom: '18px' }}>
          <Section title="Inventory Category Report">
            <DataTable
              headers={['Category', 'Items', 'Total Stock', 'Low', 'Out']}
              rows={report.inventoryCategoryRows}
              emptyText="No inventory records."
              renderRow={(row, index) => (
                <tr key={row.category} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                  <td style={{ ...tdStyle, fontWeight: '900' }}>{row.category}</td>
                  <td style={tdStyle}>{row.items}</td>
                  <td style={tdStyle}>{row.stock.toLocaleString()}</td>
                  <td style={{ ...tdStyle, color: row.low > 0 ? '#C53030' : '#777', fontWeight: row.low > 0 ? '900' : '600' }}>{row.low}</td>
                  <td style={{ ...tdStyle, color: row.out > 0 ? '#C53030' : '#777', fontWeight: row.out > 0 ? '900' : '600' }}>{row.out}</td>
                </tr>
              )}
            />
          </Section>

          <Section title="Low Stock And Out Of Stock">
            <DataTable
              headers={['Ingredient', 'Category', 'Stock', 'Threshold', 'Status']}
              rows={report.lowStockRows}
              emptyText="No low stock ingredients."
              renderRow={(row, index) => (
                <tr key={row._id || row.name} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                  <td style={{ ...tdStyle, fontWeight: '900' }}>{row.name}</td>
                  <td style={tdStyle}>{row.category || 'General'}</td>
                  <td style={{ ...tdStyle, color: (row.stock || 0) === 0 ? '#C53030' : '#D97706', fontWeight: '900' }}>{row.stock} {row.unit}</td>
                  <td style={tdStyle}>{row.lowStockAt} {row.unit}</td>
                  <td style={{ ...tdStyle, color: (row.stock || 0) === 0 ? '#C53030' : '#D97706', fontWeight: '900' }}>{(row.stock || 0) === 0 ? 'Out' : 'Low'}</td>
                </tr>
              )}
            />
          </Section>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '18px', marginBottom: '18px' }}>
          <Section title="Customer And Discount Report">
            <DataTable
              headers={['Customer Type', 'Orders', 'Gross', 'Discounts']}
              rows={report.customerRows}
              emptyText="No customer records for this period."
              renderRow={(row, index) => (
                <tr key={row.type} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                  <td style={{ ...tdStyle, fontWeight: '900', textTransform: 'capitalize' }}>{row.type.replace('_', ' ')}</td>
                  <td style={tdStyle}>{row.orders}</td>
                  <td style={{ ...tdStyle, color: '#8B5E3C', fontWeight: '900' }}>{money(row.gross)}</td>
                  <td style={{ ...tdStyle, color: row.discounts > 0 ? '#C53030' : '#777', fontWeight: row.discounts > 0 ? '900' : '600' }}>{money(row.discounts)}</td>
                </tr>
              )}
            />
          </Section>

          <Section title="Refund Report">
            <DataTable
              headers={['Slip No', 'Status', 'Reason', 'Amount']}
              rows={refunds}
              emptyText="No refunds for this period."
              renderRow={(row, index) => (
                <tr key={row._id || index} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                  <td style={{ ...tdStyle, fontWeight: '900' }}>{row.receiptNo}</td>
                  <td style={{ ...tdStyle, textTransform: 'capitalize' }}>{row.status}</td>
                  <td style={tdStyle}>{row.reason || '-'}</td>
                  <td style={{ ...tdStyle, color: row.status === 'rejected' ? '#777' : '#C53030', fontWeight: '900' }}>{money(row.totalRefunded)}</td>
                </tr>
              )}
            />
          </Section>
        </section>

        <div style={{ marginBottom: '18px' }}>
          <Section title="Cancelled Checkout Report">
            <DataTable
              headers={['Date', 'Slip No', 'Cashier', 'Items', 'Reason', 'Cart Total']}
              rows={report.cancelledTransactions}
              emptyText="No cancelled checkouts for this period."
              renderRow={(row, index) => (
                <tr key={row._id || index} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                  <td style={tdStyle}>{formatDateTime(row.createdAt)}</td>
                  <td style={{ ...tdStyle, fontWeight: '900', color: '#8B5E3C' }}>{row.receiptNo}</td>
                  <td style={tdStyle}>{row.cashier || '-'}</td>
                  <td style={tdStyle}>{(row.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0).toLocaleString()}</td>
                  <td style={tdStyle}>{row.cancelReason || '-'}</td>
                  <td style={{ ...tdStyle, color: '#C53030', fontWeight: '900' }}>{money(row.total)}</td>
                </tr>
              )}
            />
          </Section>
        </div>

        <Section title="Login Activity Report">
          <DataTable
            headers={['Login Time', 'Name', 'Email', 'Role', 'Staff ID', 'Device']}
            rows={loginActivity}
            emptyText="No login activity for this period."
            renderRow={(row, index) => (
              <tr key={row._id || index} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                <td style={tdStyle}>{formatDateTime(row.createdAt)}</td>
                <td style={{ ...tdStyle, fontWeight: '900', color: '#1a1a1a' }}>{row.name || '-'}</td>
                <td style={tdStyle}>{row.email || '-'}</td>
                <td style={{ ...tdStyle, textTransform: 'capitalize', fontWeight: '900', color: row.role === 'admin' ? '#6B46C1' : '#8B5E3C' }}>{row.role || '-'}</td>
                <td style={tdStyle}>{row.staffId || '-'}</td>
                <td style={{ ...tdStyle, minWidth: '280px', color: '#666' }}>{row.userAgent || '-'}</td>
              </tr>
            )}
          />
        </Section>

        <div style={{ height: '18px' }} />

        <Section title="System Changes Audit">
          <DataTable
            headers={['Date', 'Module', 'Action', 'Record', 'Actor', 'Details']}
            rows={systemAudit}
            emptyText="No system changes for this period."
            renderRow={(row, index) => (
              <tr key={row._id || index} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                <td style={tdStyle}>{formatDateTime(row.createdAt)}</td>
                <td style={{ ...tdStyle, fontWeight: '900', color: '#2C5282' }}>{displayAuditModule(row.module) || '-'}</td>
                <td style={{ ...tdStyle, fontWeight: '900' }}>{row.action || '-'}</td>
                <td style={{ ...tdStyle, color: '#8B5E3C', fontWeight: '900' }}>{row.entityName || row.entityId || '-'}</td>
                <td style={tdStyle}>{row.actor || '-'}</td>
                <td style={{ ...tdStyle, minWidth: '260px' }}>
                  {[
                    row.details,
                    row.changes?.email ? `Email: ${row.changes.email}` : '',
                    row.changes?.userId ? `User ID: ${row.changes.userId}` : '',
                  ].filter(Boolean).join(' - ') || '-'}
                </td>
              </tr>
            )}
          />
        </Section>

        <div style={{ height: '18px' }} />

        <Section title="System Activity Detail">
          <DataTable
            headers={['Date', 'Type', 'Reference', 'Actor', 'Detail', 'Amount']}
            rows={report.activityRows}
            emptyText="No system activity for this period."
            renderRow={(row, index) => (
              <tr key={`${row.type}-${row.reference}-${row.date}-${index}`} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                <td style={tdStyle}>{formatDateTime(row.date)}</td>
                <td style={{ ...tdStyle, fontWeight: '900' }}>{row.type}</td>
                <td style={{ ...tdStyle, color: '#8B5E3C', fontWeight: '900' }}>{row.reference || '-'}</td>
                <td style={tdStyle}>{row.actor || '-'}</td>
                <td style={{ ...tdStyle, minWidth: '260px' }}>{row.detail || '-'}</td>
                <td style={{ ...tdStyle, color: Number(row.amount) < 0 ? '#C53030' : '#276749', fontWeight: row.amount !== '' ? '900' : '600' }}>{row.amount === '' ? '-' : money(row.amount)}</td>
              </tr>
            )}
          />
        </Section>
      </main>
    </div>
  );
};

export default ReportsPage;
