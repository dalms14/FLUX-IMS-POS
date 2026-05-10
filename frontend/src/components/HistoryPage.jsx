import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import { isAdminRole } from '../utils/roles';

const ALL_TABS = [
  'Transaction History',
  'Inventory History',
  { label: 'Sales History', adminOnly: true },
  'Refunds',
];

const tableHeaderStyle = {
  padding: '14px 16px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: '800',
  color: '#D99545',
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
  whiteSpace: 'nowrap',
};

const tableCellStyle = {
  padding: '13px 16px',
  fontSize: '13px',
  color: '#333',
  borderBottom: '1px solid #EEE6DE',
};

const cardStyle = {
  backgroundColor: '#fff',
  border: '1px solid #E0D5CB',
  borderRadius: '8px',
  padding: '16px',
  boxShadow: '0 6px 18px rgba(59, 35, 18, 0.05)',
};

const HistoryPage = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = isAdminRole(user.role);
  const tabs = ALL_TABS
    .filter(tab => typeof tab === 'string' || isAdmin || !tab.adminOnly)
    .map(tab => typeof tab === 'string' ? tab : tab.label);

  const [activeTab, setActiveTab] = useState('Transaction History');
  const [transactions, setTransactions] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [sales, setSales] = useState([]);
  const [salesSummary, setSalesSummary] = useState(null);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'Transaction History') {
        const res = await fetch('http://localhost:5000/api/transactions');
        const data = await res.json();
        setTransactions(data.data || data || []);
      } else if (activeTab === 'Inventory History') {
        const res = await fetch('http://localhost:5000/api/inventory-history');
        const data = await res.json();
        setInventory(data.data || []);
      } else if (activeTab === 'Sales History') {
        const res = await fetch('http://localhost:5000/api/sales-history');
        const data = await res.json();
        setSales(data.data || []);
        setSalesSummary(data.summary || null);
      } else if (activeTab === 'Refunds') {
        const res = await fetch('http://localhost:5000/api/refunds');
        const data = await res.json();
        setRefunds(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    if (!dateString || Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-PH');
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    if (!dateString || Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-PH', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatMoney = (value) => `PHP ${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

  const statusBadge = (label, tone = 'neutral') => {
    const styles = {
      success: { background: '#E7F8EF', color: '#057A45' },
      danger: { background: '#FDECEC', color: '#C53030' },
      warning: { background: '#FFF6DF', color: '#996515' },
      info: { background: '#EAF4FF', color: '#2563A8' },
      neutral: { background: '#F4EFEA', color: '#6B4A2F' },
    };
    const style = styles[tone] || styles.neutral;
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: '24px',
        padding: '3px 10px',
        borderRadius: '999px',
        backgroundColor: style.background,
        color: style.color,
        fontSize: '12px',
        fontWeight: '800',
      }}>
        {label || '-'}
      </span>
    );
  };

  const metricGrid = (cards) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
      {cards.map(card => (
        <div key={card.label} style={cardStyle}>
          <div style={{ fontSize: '11px', fontWeight: '800', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            {card.label}
          </div>
          <div style={{ marginTop: '8px', fontSize: card.compact ? '24px' : '28px', lineHeight: 1, fontWeight: '900', color: '#1A1208' }}>
            {card.value}
          </div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#8A8178' }}>{card.hint}</div>
        </div>
      ))}
    </div>
  );

  const reportTable = ({ title, subtitle, headers, rows, emptyText, minWidth = '860px' }) => (
    <div style={{ backgroundColor: '#fff', border: '1px solid #D8C8B8', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ padding: '16px 18px', borderBottom: '1px solid #E9DED4' }}>
        <div style={{ fontSize: '16px', fontWeight: '900', color: '#1A1208' }}>{title}</div>
        {subtitle && <div style={{ marginTop: '4px', fontSize: '12px', color: '#8A8178' }}>{subtitle}</div>}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth }}>
          <thead>
            <tr style={{ backgroundColor: '#1A1208' }}>
              {headers.map(header => <th key={header} style={tableHeaderStyle}>{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} style={{ ...tableCellStyle, padding: '28px 16px', textAlign: 'center', color: '#999' }}>
                  {emptyText}
                </td>
              </tr>
            ) : rows}
          </tbody>
        </table>
      </div>
    </div>
  );

  const buildSalesSummary = (rows) => {
    const productCount = rows.length;
    const totalQty = rows.reduce((sum, row) => sum + Number(row.totalQty || 0), 0);
    const totalRevenue = rows.reduce((sum, row) => sum + Number(row.totalRevenue || 0), 0);
    const orderCount = rows.reduce((sum, row) => sum + Number(row.transactionCount || 0), 0);
    return { productCount, totalQty, totalRevenue, orderCount };
  };

  const updateRefundStatus = async (refund, action) => {
    setError('');
    try {
      const res = await fetch(`http://localhost:5000/api/refunds/${refund._id}/${action}`, {
        method: 'PATCH',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || `Failed to ${action} refund`);
      }

      await fetchData();
    } catch (err) {
      console.error('Error updating refund status:', err);
      setError(err.message || 'Failed to update refund');
    }
  };

  const actionButtonStyle = {
    padding: '7px 11px',
    borderRadius: '6px',
    border: 'none',
    color: '#fff',
    fontSize: '11px',
    fontWeight: '800',
    cursor: 'pointer',
  };

  const renderTransactionHistory = () => {
    const completed = transactions.filter(row => row.orderStatus === 'completed').length;
    const cancelled = transactions.filter(row => row.orderStatus === 'cancelled').length;
    const revenue = transactions
      .filter(row => row.orderStatus === 'completed')
      .reduce((sum, row) => sum + Number(row.total || 0), 0);
    const latest = transactions[0];

    return (
      <div style={{ display: 'grid', gap: '16px' }}>
        {metricGrid([
          { label: 'Transactions', value: transactions.length.toLocaleString(), hint: 'Completed and cancelled records' },
          { label: 'Completed', value: completed.toLocaleString(), hint: 'Finished orders' },
          { label: 'Cancelled', value: cancelled.toLocaleString(), hint: 'Cancelled before completion' },
          { label: 'Revenue', value: formatMoney(revenue), hint: 'Completed orders only', compact: true },
        ])}

        {latest && (
          <div style={{ backgroundColor: '#FFF8EF', border: '1px solid #E7C9A9', borderRadius: '8px', padding: '14px 16px' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#9A632F', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Latest Record</div>
            <div style={{ marginTop: '5px', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <strong style={{ color: '#1A1208' }}>{latest.receiptNo || 'No slip number'}</strong>
              <span style={{ color: '#5B4634', fontSize: '13px', fontWeight: '700' }}>{formatDateTime(latest.createdAt)}</span>
            </div>
          </div>
        )}

        {reportTable({
          title: 'Transaction Records',
          subtitle: 'Final completed orders and cancelled checkout records.',
          headers: ['Date', 'Slip No', 'Total Amount', 'Cashier', 'Payment', 'Status'],
          emptyText: 'No transactions found',
          rows: transactions.map((row, i) => (
            <tr key={row._id || i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#FBF8F5' }}>
              <td style={tableCellStyle}>{formatDateTime(row.createdAt)}</td>
              <td style={{ ...tableCellStyle, color: '#8B5E3C', fontWeight: '800' }}>{row.receiptNo || '-'}</td>
              <td style={{ ...tableCellStyle, fontWeight: '900', color: '#1A1208' }}>{formatMoney(row.total)}</td>
              <td style={tableCellStyle}>{row.cashier || '-'}</td>
              <td style={tableCellStyle}>{statusBadge(row.paymentMethod || 'Unknown', 'info')}</td>
              <td style={tableCellStyle}>{statusBadge(row.orderStatus || 'completed', row.orderStatus === 'cancelled' ? 'danger' : 'success')}</td>
            </tr>
          )),
        })}
      </div>
    );
  };

  const renderInventoryHistory = () => {
    const stockOut = inventory.filter(row => row.action === 'Stock Out').length;
    const deducted = inventory.filter(row => row.action?.includes('Deducted')).length;
    const latest = inventory[0];

    return (
      <div style={{ display: 'grid', gap: '16px' }}>
        {metricGrid([
          { label: 'Inventory Logs', value: inventory.length.toLocaleString(), hint: 'All recorded stock movements' },
          { label: 'Stock Out', value: stockOut.toLocaleString(), hint: 'Manual damage, theft, or loss' },
          { label: 'Refund Waste', value: deducted.toLocaleString(), hint: 'Waste from refunded made items' },
          { label: 'Latest Change', value: latest ? formatDate(latest.date) : '-', hint: latest?.item || 'No activity yet', compact: true },
        ])}

        {reportTable({
          title: 'Inventory Movement',
          subtitle: 'Manual stock-out and refund waste activity.',
          headers: ['Date', 'Item', 'Action', 'Quantity', 'By', 'Reason'],
          emptyText: 'No inventory history found',
          rows: inventory.map((row, i) => {
            const isLoss = row.action === 'Stock Out' || row.action?.includes('Deducted');
            return (
              <tr key={row._id || i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#FBF8F5' }}>
                <td style={tableCellStyle}>{formatDateTime(row.date)}</td>
                <td style={{ ...tableCellStyle, fontWeight: '800', color: '#1A1208' }}>{row.item || '-'}</td>
                <td style={tableCellStyle}>{statusBadge(row.action, isLoss ? 'danger' : 'success')}</td>
                <td style={{ ...tableCellStyle, fontWeight: '800' }}>{row.quantity || '-'}</td>
                <td style={tableCellStyle}>{row.by || '-'}</td>
                <td style={{ ...tableCellStyle, color: '#6B7280' }}>{row.reason || '-'}</td>
              </tr>
            );
          }),
        })}
      </div>
    );
  };

  const renderSalesHistory = () => {
    const summary = salesSummary || buildSalesSummary(sales);
    const topProduct = sales[0];

    return (
      <div style={{ display: 'grid', gap: '16px' }}>
        {metricGrid([
          { label: 'Products Sold', value: Number(summary.productCount || 0).toLocaleString(), hint: 'Products with completed sales' },
          { label: 'Units Sold', value: Number(summary.totalQty || 0).toLocaleString(), hint: 'Net quantity after refunds' },
          { label: 'Revenue', value: formatMoney(summary.totalRevenue), hint: 'Completed sales only', compact: true },
          { label: 'Orders', value: Number(summary.orderCount || 0).toLocaleString(), hint: 'Completed order count' },
        ])}

        {topProduct && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', backgroundColor: '#FFF8EF', border: '1px solid #E7C9A9', borderRadius: '8px', padding: '14px 16px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#9A632F', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Top Seller</div>
              <div style={{ marginTop: '4px', fontSize: '16px', fontWeight: '900', color: '#1A1208' }}>{topProduct.productName}</div>
            </div>
            <div style={{ display: 'flex', gap: '18px', color: '#5B4634', fontSize: '13px', fontWeight: '700', flexWrap: 'wrap' }}>
              <span>{Number(topProduct.totalQty || 0).toLocaleString()} units</span>
              <span>{formatMoney(topProduct.totalRevenue)}</span>
              <span>Last sold {formatDateTime(topProduct.lastSoldAt)}</span>
            </div>
          </div>
        )}

        {reportTable({
          title: 'Product Sales',
          subtitle: 'Completed orders only. Refunded pending items are removed from quantity and revenue.',
          headers: ['Rank', 'Product', 'Category', 'Qty Sold', 'Orders', 'Avg Price', 'Total Revenue', 'Last Sold'],
          emptyText: 'No completed sales found',
          rows: sales.map((row, i) => (
            <tr key={row._id || i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#FBF8F5' }}>
              <td style={{ ...tableCellStyle, color: '#9A632F', fontWeight: '900' }}>#{i + 1}</td>
              <td style={{ ...tableCellStyle, fontWeight: '800', color: '#1A1208' }}>{row.productName || 'Unnamed product'}</td>
              <td style={tableCellStyle}>{statusBadge(row.category || 'Uncategorized')}</td>
              <td style={{ ...tableCellStyle, fontWeight: '800' }}>{Number(row.totalQty || 0).toLocaleString()}</td>
              <td style={tableCellStyle}>{Number(row.transactionCount || 0).toLocaleString()}</td>
              <td style={tableCellStyle}>{formatMoney(row.avgPrice)}</td>
              <td style={{ ...tableCellStyle, fontWeight: '900', color: '#8B5E3C' }}>{formatMoney(row.totalRevenue)}</td>
              <td style={{ ...tableCellStyle, color: '#6B7280' }}>{formatDateTime(row.lastSoldAt)}</td>
            </tr>
          )),
        })}
      </div>
    );
  };

  const renderRefunds = () => {
    const pending = refunds.filter(row => row.status === 'pending').length;
    const completed = refunds.filter(row => row.status === 'completed').length;
    const totalRefunded = refunds
      .filter(row => row.status === 'completed' || row.status === 'approved')
      .reduce((sum, row) => sum + Number(row.totalRefunded || 0), 0);

    const statusTone = {
      pending: 'warning',
      approved: 'info',
      completed: 'success',
      rejected: 'danger',
    };

    return (
      <div style={{ display: 'grid', gap: '16px' }}>
        {metricGrid([
          { label: 'Refund Requests', value: refunds.length.toLocaleString(), hint: 'All refund records' },
          { label: 'Pending', value: pending.toLocaleString(), hint: 'Waiting for action' },
          { label: 'Completed', value: completed.toLocaleString(), hint: 'Finished refunds' },
          { label: 'Refund Amount', value: formatMoney(totalRefunded), hint: 'Approved and completed', compact: true },
        ])}

        {reportTable({
          title: 'Refund Records',
          subtitle: 'Refund approvals and completion history.',
          headers: ['Date', 'Slip No', 'Amount Refunded', 'Reason', 'Status', 'Action'],
          emptyText: 'No refunds found',
          minWidth: '960px',
          rows: refunds.map((row, i) => (
            <tr key={row._id || i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#FBF8F5' }}>
              <td style={tableCellStyle}>{formatDateTime(row.createdAt)}</td>
              <td style={{ ...tableCellStyle, color: '#8B5E3C', fontWeight: '800' }}>{row.receiptNo || '-'}</td>
              <td style={{ ...tableCellStyle, color: '#C53030', fontWeight: '900' }}>{formatMoney(row.totalRefunded)}</td>
              <td style={{ ...tableCellStyle, maxWidth: '320px', color: '#4B5563' }}>{row.reason || '-'}</td>
              <td style={tableCellStyle}>{statusBadge(row.status?.charAt(0).toUpperCase() + row.status?.slice(1), statusTone[row.status])}</td>
              <td style={tableCellStyle}>
                {row.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => updateRefundStatus(row, 'approve')} style={{ ...actionButtonStyle, backgroundColor: '#276749' }}>Approve</button>
                    <button onClick={() => updateRefundStatus(row, 'reject')} style={{ ...actionButtonStyle, backgroundColor: '#C53030' }}>Reject</button>
                  </div>
                )}
                {row.status === 'approved' && (
                  <button onClick={() => updateRefundStatus(row, 'complete')} style={{ ...actionButtonStyle, backgroundColor: '#2F5496' }}>Complete</button>
                )}
                {(row.status === 'completed' || row.status === 'rejected') && (
                  <span style={{ color: '#999', fontSize: '12px', fontWeight: '700' }}>No action</span>
                )}
              </td>
            </tr>
          )),
        })}
      </div>
    );
  };

  const renderContent = () => {
    if (loading) {
      return <div style={{ padding: '32px', textAlign: 'center', color: '#666' }}>Loading data...</div>;
    }

    if (error) {
      return <div style={{ padding: '32px', textAlign: 'center', color: '#C53030' }}>{error}</div>;
    }

    if (activeTab === 'Transaction History') return renderTransactionHistory();
    if (activeTab === 'Inventory History') return renderInventoryHistory();
    if (activeTab === 'Sales History') return renderSalesHistory();
    if (activeTab === 'Refunds') return renderRefunds();
    return null;
  };

  return (
    <div className="mobile-app-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#F5F0EB' }}>
      <Sidebar />

      <div className="mobile-page-content" style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '28px', flexWrap: 'wrap' }}>
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: activeTab === tab ? 'none' : '1.5px solid #1a1a1a',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '800',
                backgroundColor: activeTab === tab ? '#1a1a1a' : '#fff',
                color: activeTab === tab ? '#fff' : '#1a1a1a',
                transition: 'all 0.15s',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {renderContent()}
      </div>
    </div>
  );
};

export default HistoryPage;
