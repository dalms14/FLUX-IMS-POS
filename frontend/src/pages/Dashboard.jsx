import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import { FiPackage, FiShoppingCart, FiCheck, FiSettings, FiBarChart2, FiBell, FiTruck, FiX } from 'react-icons/fi';
import { LuPhilippinePeso } from 'react-icons/lu';
import { hasPermission } from '../utils/roles';

const DASHBOARD_REFRESH_MS = 5000;

// KPI Card Component
const KPICard = ({ icon, label, value, subtext, trend, color }) => (
  <div style={{
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    border: '1px solid #E0D5CB',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
  }}
  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
  onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
      <div style={{ fontSize: '32px' }}>{icon}</div>
      {trend && (
        <div style={{ fontSize: '12px', fontWeight: '700', color: trend > 0 ? '#22863A' : '#CB2431', backgroundColor: trend > 0 ? '#F0FFF4' : '#FFEEF0', padding: '4px 8px', borderRadius: '4px' }}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </div>
      )}
    </div>
    <p style={{ fontSize: '12px', fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px' }}>{label}</p>
    <p style={{ fontSize: '32px', fontWeight: '900', color: color || '#1a1a1a', margin: '0 0 8px' }}>{value}</p>
    {subtext && <p style={{ fontSize: '12px', color: '#bbb', margin: 0 }}>{subtext}</p>}
  </div>
);

const statusStyles = {
  pending: { backgroundColor: '#FFFAF0', color: '#975A16' },
  preparing: { backgroundColor: '#EBF8FF', color: '#2B6CB0' },
  ready: { backgroundColor: '#F0FFF4', color: '#276749' },
  completed: { backgroundColor: '#F0FFF4', color: '#22863A' },
  cancelled: { backgroundColor: '#F7FAFC', color: '#718096' },
  'refund pending': { backgroundColor: '#FEF3C7', color: '#92400E' },
  'partial refund': { backgroundColor: '#FFF5F5', color: '#C53030' },
  refunded: { backgroundColor: '#FFF5F5', color: '#C53030' },
};

const getOrderStatus = (transaction) => String(transaction.orderStatus || 'completed').toLowerCase();

const getTransactionStatus = (transaction, refundMap) => {
  const orderStatus = getOrderStatus(transaction);
  if (orderStatus !== 'completed') return orderStatus;

  const relatedRefunds = refundMap.get(transaction._id) || refundMap.get(transaction.receiptNo) || [];
  const activeRefunds = relatedRefunds.filter(r => r.status !== 'rejected');

  if (activeRefunds.length === 0) return 'completed';
  if (activeRefunds.some(r => r.status === 'pending')) return 'refund pending';

  const refundedTotal = activeRefunds
    .filter(r => ['approved', 'completed'].includes(r.status))
    .reduce((sum, r) => sum + (r.totalRefunded || 0), 0);

  return refundedTotal >= (transaction.total || 0) ? 'refunded' : 'partial refund';
};

// Transaction Row Component
const TransactionRow = ({ receipt, items, amount, method, time, status }) => (
  <div className="dashboard-transaction-row" style={{
    display: 'grid',
    gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr',
    padding: '16px 20px',
    borderBottom: '1px solid #f0f0f0',
    alignItems: 'center',
    fontSize: '13px',
  }}>
    <div>
      <p style={{ fontSize: '13px', fontWeight: '700', color: '#1a1a1a', margin: 0 }}>{receipt}</p>
      <p style={{ fontSize: '11px', color: '#aaa', margin: '4px 0 0' }}>{items} item{items !== 1 ? 's' : ''}</p>
    </div>
    <p style={{ fontWeight: '700', color: '#8B5E3C', margin: 0 }}>₱{amount.toLocaleString()}</p>
    <p style={{ color: '#666', margin: 0 }}>{method}</p>
    <p style={{ color: '#999', margin: 0 }}>{time}</p>
    <div style={{ textAlign: 'center' }}>
      <span style={{
        ...(statusStyles[status] || statusStyles.completed),
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: '700',
        textTransform: 'capitalize',
      }}>
        {status}
      </span>
    </div>
  </div>
);

const DeliveryArrivalModal = ({ order, onClose, onRecorded }) => {
  const [rows, setRows] = useState(() => order.items.map(item => ({ itemId: item._id, quantity: '', expirationDate: '', note: '' })));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const updateRow = (index, field, value) => setRows(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  const submit = async event => {
    event.preventDefault();
    const items = rows.filter(row => Number(row.quantity) > 0);
    if (items.length === 0) return setError('Enter the quantity physically delivered for at least one item.');
    setSaving(true); setError('');
    try {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const response = await axios.post(`http://localhost:5000/api/purchase-orders/${order._id}/record-arrival`, { items, actor: currentUser.name || currentUser.email || 'System', actorEmail: currentUser.email || '' });
      onRecorded(response.data.order);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not record this delivery.');
    } finally {
      setSaving(false);
    }
  };
  return <div onMouseDown={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2200, padding: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(26,18,8,.55)', fontFamily: 'Segoe UI, sans-serif' }}><form onMouseDown={event => event.stopPropagation()} onSubmit={submit} style={{ width: 'min(700px, 100%)', maxHeight: '90vh', overflow: 'auto', borderRadius: '14px', backgroundColor: '#fff', boxShadow: '0 24px 64px rgba(0,0,0,.25)' }}><div style={{ padding: '21px 24px', display: 'flex', justifyContent: 'space-between', gap: '15px', borderBottom: '1px solid #E8DDD0' }}><div><p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: '900', color: '#8B5E3C', letterSpacing: '.7px' }}>ASSIGNED DELIVERY</p><h2 style={{ margin: 0, fontSize: '20px', color: '#1a1a1a' }}>{order.purchaseOrderNo}</h2><p style={{ margin: '6px 0 0', color: '#777', fontSize: '12px' }}>Check the physical delivery, then record only the quantity received. A manager will approve inventory afterward.</p></div><button type="button" onClick={onClose} style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid #E0D5CB', background: '#fff', cursor: 'pointer', color: '#7A6A5A' }}><FiX /></button></div><div style={{ padding: '21px 24px', display: 'grid', gap: '10px' }}>{order.items.map((item, index) => { const remaining = Number(item.orderedQuantity) - Number(item.receivedQuantity || 0); return <div key={item._id} style={{ padding: '12px', borderRadius: '9px', background: '#FAF7F4', border: '1px solid #E8DDD0', display: 'grid', gridTemplateColumns: '1.4fr .65fr .85fr', gap: '8px', alignItems: 'end' }}><div><b style={{ fontSize: '13px' }}>{item.name}</b><p style={{ margin: '3px 0 0', fontSize: '11px', color: '#777' }}>Ordered remaining: {remaining} {item.unit}</p></div><div><label style={{ display: 'block', marginBottom: '5px', fontSize: '10px', fontWeight: '900', color: '#6B5A4C', textTransform: 'uppercase' }}>Delivered now</label><input type="number" min="0" max={remaining} step="any" value={rows[index].quantity} onChange={e => updateRow(index, 'quantity', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #D8CABB' }} /></div><div><label style={{ display: 'block', marginBottom: '5px', fontSize: '10px', fontWeight: '900', color: '#6B5A4C', textTransform: 'uppercase' }}>Expiry date</label><input type="date" value={rows[index].expirationDate} onChange={e => updateRow(index, 'expirationDate', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #D8CABB' }} /></div></div>; })}{error && <p style={{ margin: 0, padding: '10px 12px', borderRadius: '8px', color: '#C53030', background: '#FFF5F5', fontSize: '12px', fontWeight: '700' }}>{error}</p>}</div><div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: '9px', borderTop: '1px solid #E8DDD0' }}><button type="button" onClick={onClose} style={{ padding: '10px 13px', borderRadius: '8px', border: '1px solid #D4B89A', color: '#6F4A2F', background: '#fff', fontWeight: '800', cursor: 'pointer' }}>Cancel</button><button disabled={saving} style={{ padding: '10px 13px', borderRadius: '8px', border: 'none', color: '#fff', background: '#276749', fontWeight: '900', cursor: 'pointer', opacity: saving ? .65 : 1 }}><FiTruck style={{ verticalAlign: 'middle' }} /> {saving ? 'Saving…' : 'Record Delivery'}</button></div></form></div>;
};

const Dashboard = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const canStartOrder = hasPermission(user, 'items');
  const canViewProducts = hasPermission(user, 'products');
  const canViewInventory = hasPermission(user, 'inventory');
  const canViewTransactions = hasPermission(user, 'transactions');
  const notificationAudience = String(user.role || '').toLowerCase() === 'admin' || String(user.role || '').toLowerCase() === 'owner' || ['finance', 'hr'].includes(String(user.jobRole || '').toLowerCase()) || String(user.email || '').toLowerCase() === 'admin@elicoffee.com' || String(user.userId || '').toUpperCase() === 'ELI001';
  const [transactions, setTransactions] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [approvalNotifications, setApprovalNotifications] = useState([]);
  const [assignedDeliveries, setAssignedDeliveries] = useState([]);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async (showInitialLoading = false) => {
    if (showInitialLoading) {
      setLoading(true);
    }

    try {
      const [transactionRes, refundRes, notificationRes, assignedDeliveryRes] = await Promise.all([
        axios.get('http://localhost:5000/api/transactions'),
        axios.get('http://localhost:5000/api/refunds'),
        user.email ? axios.get(`http://localhost:5000/api/notifications?email=${encodeURIComponent(user.email)}`) : Promise.resolve({ data: { data: [] } }),
        user.email ? axios.get(`http://localhost:5000/api/purchase-orders/my-deliveries?email=${encodeURIComponent(user.email)}`) : Promise.resolve({ data: { data: [] } }),
      ]);
      setTransactions(transactionRes.data.data || transactionRes.data);
      setRefunds(refundRes.data.data || refundRes.data);
      setApprovalNotifications(notificationRes.data.data || []);
      setAssignedDeliveries(assignedDeliveryRes.data.data || []);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setTransactions([]);
      setRefunds([]);
      setApprovalNotifications([]);
      setAssignedDeliveries([]);
    } finally {
      setLoading(false);
    }
  }, [user.email]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (!document.hidden) {
        fetchDashboardData();
      }
    };

    fetchDashboardData(true);
    const refreshTimer = setInterval(refreshWhenVisible, DASHBOARD_REFRESH_MS);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);

    return () => {
      clearInterval(refreshTimer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
    };
  }, [fetchDashboardData]);

  // Calculate stats from transactions
  const todayTransactions = transactions.filter(t => {
    const tDate = new Date(t.createdAt).toDateString();
    const today = new Date().toDateString();
    return tDate === today;
  });
  const todayFinalTransactions = todayTransactions.filter(t =>
    ['completed', 'cancelled'].includes(getOrderStatus(t))
  );

  const todayCompletedTransactions = todayTransactions.filter(t =>
    ['completed', 'cancelled'].includes(getOrderStatus(t))
  );

  const todaySales = todayCompletedTransactions.reduce((sum, t) => sum + t.total, 0);
  const todayOrders = todayFinalTransactions.length;
  const todayItemsSold = todayFinalTransactions.reduce((sum, t) => (
    sum + (t.items || []).reduce((itemSum, item) => itemSum + (item.quantity || 0), 0)
  ), 0);
  const refundMap = refunds.reduce((map, refund) => {
    const transactionKey = String(refund.transactionId || '');
    const receiptKey = refund.receiptNo || '';

    [transactionKey, receiptKey].filter(Boolean).forEach(key => {
      map.set(key, [...(map.get(key) || []), refund]);
    });

    return map;
  }, new Map());
  const completedTodayOrders = todayFinalTransactions.filter(t => getTransactionStatus(t, refundMap) === 'completed').length;
  const refundedTodayOrders = todayFinalTransactions.length - completedTodayOrders;

  const now = new Date();
  const timeString = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  const dateString = now.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="mobile-app-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#F5F0EB' }}>
      <Sidebar />

      <div className="dashboard-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header Bar */}
        <div className="dashboard-header" style={{ backgroundColor: '#fff', borderBottom: '1px solid #E0D5CB', padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#1a1a1a', margin: 0, letterSpacing: '-0.5px' }}>Dashboard</h1>
            <p style={{ fontSize: '13px', color: '#999', margin: '4px 0 0' }}>{dateString} • {timeString}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '12px', color: '#999', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Logged in as</p>
            <p style={{ fontSize: '15px', fontWeight: '800', color: '#8B5E3C', margin: '2px 0 0' }}>{user.name || 'Admin'}</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="dashboard-main" style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
          {/* KPI Cards Grid */}
          <div className="dashboard-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
            <KPICard
              icon={<LuPhilippinePeso size={32} color="#8B5E3C" />}
              label="Today's Revenue"
              value={`₱${todaySales.toLocaleString()}`}
              subtext={`${todayOrders} orders`}
              trend={12}
              color="#8B5E3C"
            />
            <KPICard
              icon={<FiPackage size={32} color="#38A169" />}
              label="Total Orders"
              value={todayOrders}
              subtext="Today"
              trend={8}
              color="#38A169"
            />
            <KPICard
              icon={<FiShoppingCart size={32} color="#D69E2E" />}
              label="Items Sold"
              value={todayItemsSold}
              subtext={`Avg ${todayOrders > 0 ? Math.round(todayItemsSold / todayOrders) : 0} per order`}
              trend={5}
              color="#D69E2E"
            />
            <KPICard
              icon={<FiCheck size={32} color="#276749" />}
              label="Completed"
              value={completedTodayOrders}
              subtext={refundedTodayOrders > 0 ? `${refundedTodayOrders} with refund activity` : 'No refunds today'}
              color="#276749"
            />
          </div>

          {notificationAudience && (
            <section style={{ marginBottom: '24px', backgroundColor: '#fff', borderRadius: '16px', overflow: 'hidden', border: '1px solid #D8C8EE', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ padding: '17px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', backgroundColor: '#FAF5FF', borderBottom: '1px solid #E9D8FD' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '34px', height: '34px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '9px', backgroundColor: '#805AD5', color: '#fff' }}><FiBell size={18} /></span>
                  <div><h2 style={{ margin: 0, fontSize: '15px', color: '#44337A' }}>Purchase Order Approvals</h2><p style={{ margin: '3px 0 0', fontSize: '11px', color: '#6B46C1' }}>Reported deliveries stay out of inventory until approval.</p></div>
                </div>
                <a href="/purchase-orders" style={{ fontSize: '12px', color: '#6B46C1', fontWeight: '900', textDecoration: 'none' }}>Open Purchase Orders →</a>
              </div>
              {approvalNotifications.length === 0 ? (
                <p style={{ margin: 0, padding: '18px 20px', color: '#718096', fontSize: '12px' }}>No delivered purchase orders are awaiting review.</p>
              ) : (
                <div>{approvalNotifications.slice(0, 4).map(notification => <a key={notification._id} href="/purchase-orders" style={{ display: 'flex', padding: '13px 20px', gap: '12px', alignItems: 'center', textDecoration: 'none', color: 'inherit', borderBottom: '1px solid #F3E8FF' }}><FiPackage size={17} color="#805AD5" /><div style={{ minWidth: 0, flex: 1 }}><p style={{ margin: 0, fontSize: '13px', fontWeight: '900', color: '#2D3748' }}>{notification.purchaseOrderNo || 'Purchase order delivery'}</p><p style={{ margin: '3px 0 0', fontSize: '11px', color: '#718096' }}>{notification.message}</p></div><span style={{ color: '#805AD5', fontSize: '11px', fontWeight: '800', whiteSpace: 'nowrap' }}>{new Date(notification.createdAt).toLocaleString('en-PH', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></a>)}</div>
              )}
            </section>
          )}

          {assignedDeliveries.length > 0 && (
            <section style={{ marginBottom: '24px', backgroundColor: '#fff', borderRadius: '16px', overflow: 'hidden', border: '1px solid #BEE3F8', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ padding: '17px 20px', display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#EBF8FF', borderBottom: '1px solid #BEE3F8' }}><span style={{ width: '34px', height: '34px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '9px', backgroundColor: '#2B6CB0', color: '#fff' }}><FiTruck size={18} /></span><div><h2 style={{ margin: 0, fontSize: '15px', color: '#2C5282' }}>My Assigned Deliveries</h2><p style={{ margin: '3px 0 0', fontSize: '11px', color: '#2B6CB0' }}>Verify the physical supplies, then record what actually arrived.</p></div></div>
              {assignedDeliveries.map(order => <div key={order._id} style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #E6F6FF' }}><div style={{ flex: 1, minWidth: 0 }}><p style={{ margin: 0, fontSize: '13px', color: '#1A202C', fontWeight: '900' }}>{order.purchaseOrderNo} — {order.supplierName}</p><p style={{ margin: '3px 0 0', fontSize: '11px', color: '#718096' }}>{order.items.length} item{order.items.length === 1 ? '' : 's'} · Expected: {order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString('en-PH') : 'Not set'}</p></div><button onClick={() => setSelectedDelivery(order)} style={{ padding: '9px 11px', borderRadius: '8px', border: 'none', backgroundColor: '#2B6CB0', color: '#fff', fontSize: '12px', fontWeight: '900', cursor: 'pointer', whiteSpace: 'nowrap' }}>Record Delivery</button></div>)}
            </section>
          )}

          {/* Bottom Section - Transactions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
            {/* Recent Transactions */}
            <div style={{ backgroundColor: '#fff', borderRadius: '16px', overflow: 'hidden', border: '1px solid #E0D5CB', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              {/* Header */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #E0D5CB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1a1a1a', margin: 0 }}>Recent Transactions</h3>
                {canViewTransactions && (
                  <a href="/transactions" style={{ fontSize: '12px', color: '#8B5E3C', fontWeight: '700', textDecoration: 'none', cursor: 'pointer' }}>View All →</a>
                )}
              </div>

              {/* Table Header */}
              <div className="dashboard-transaction-head" style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr', padding: '16px 20px', backgroundColor: '#1A1208', gap: '0' }}>
                {['Slip No.', 'Amount', 'Method', 'Time', 'Status'].map(h => (
                  <p key={h} style={{ fontSize: '11px', fontWeight: '700', color: '#C4894A', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>{h}</p>
                ))}
              </div>

              {/* Transactions List */}
              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#bbb' }}>Loading transactions...</div>
              ) : transactions.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#bbb' }}>No transactions yet</div>
              ) : (
                (() => {
                  // Final transaction records, newest first.
                  const sorted = [...transactions].sort((a, b) => {
                    return new Date(b.createdAt) - new Date(a.createdAt);
                  });
                  return sorted.slice(0, 5).map((t, i) => (
                    <TransactionRow
                      key={t._id}
                      receipt={t.receiptNo}
                      items={t.items?.length || 0}
                      amount={t.total || 0}
                      method={t.paymentMethod}
                      time={t.createdAt ? new Date(t.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      status={getTransactionStatus(t, refundMap)}
                    />
                  ));
                })()
              )}
            </div>

            {/* Quick Actions */}
            <div className="dashboard-actions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              {canStartOrder && (
                <a href="/items" style={{ backgroundColor: '#8B5E3C', color: '#fff', padding: '16px', borderRadius: '12px', textDecoration: 'none', textAlign: 'center', fontWeight: '700', transition: 'all 0.2s', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#6B4423'; e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#8B5E3C'; e.currentTarget.style.transform = 'translateY(0)'; }}><FiPackage /> Start Order</a>
              )}
              {canViewProducts && (
                <a href="/products" style={{ backgroundColor: '#38A169', color: '#fff', padding: '16px', borderRadius: '12px', textDecoration: 'none', textAlign: 'center', fontWeight: '700', transition: 'all 0.2s', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#2D6A4F'; e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#38A169'; e.currentTarget.style.transform = 'translateY(0)'; }}><FiSettings /> Products</a>
              )}
              {canViewInventory && (
                <a href="/inventory" style={{ backgroundColor: '#D69E2E', color: '#fff', padding: '16px', borderRadius: '12px', textDecoration: 'none', textAlign: 'center', fontWeight: '700', transition: 'all 0.2s', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#A97D1A'; e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#D69E2E'; e.currentTarget.style.transform = 'translateY(0)'; }}><FiBarChart2 /> Inventory</a>
              )}
            </div>
          </div>
        </div>
      </div>
      {selectedDelivery && <DeliveryArrivalModal order={selectedDelivery} onClose={() => setSelectedDelivery(null)} onRecorded={() => { setSelectedDelivery(null); fetchDashboardData(); }} />}
    </div>
  );
};

export default Dashboard;
