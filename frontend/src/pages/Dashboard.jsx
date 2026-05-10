import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import { FiPackage, FiShoppingCart, FiCheck, FiSettings, FiBarChart2 } from 'react-icons/fi';
import { LuPhilippinePeso } from 'react-icons/lu';
import { isAdminRole } from '../utils/roles';

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
  completed: { backgroundColor: '#F0FFF4', color: '#22863A' },
  'refund pending': { backgroundColor: '#FEF3C7', color: '#92400E' },
  'partial refund': { backgroundColor: '#FFF5F5', color: '#C53030' },
  refunded: { backgroundColor: '#FFF5F5', color: '#C53030' },
};

const getTransactionStatus = (transaction, refundMap) => {
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

const Dashboard = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = isAdminRole(user.role);
  const [transactions, setTransactions] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async (showInitialLoading = false) => {
    if (showInitialLoading) {
      setLoading(true);
    }

    try {
      const [transactionRes, refundRes] = await Promise.all([
        axios.get('http://localhost:5000/api/transactions'),
        axios.get('http://localhost:5000/api/refunds'),
      ]);
      setTransactions(transactionRes.data.data || transactionRes.data);
      setRefunds(refundRes.data.data || refundRes.data);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setTransactions([]);
      setRefunds([]);
    } finally {
      setLoading(false);
    }
  };

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
  }, []);

  // Calculate stats from transactions
  const todayTransactions = transactions.filter(t => {
    const tDate = new Date(t.createdAt).toDateString();
    const today = new Date().toDateString();
    return tDate === today;
  });

  const todaySales = todayTransactions.reduce((sum, t) => sum + t.total, 0);
  const todayOrders = todayTransactions.length;
  const todayItemsSold = todayTransactions.reduce((sum, t) => (
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
  const completedTodayOrders = todayTransactions.filter(t => getTransactionStatus(t, refundMap) === 'completed').length;
  const refundedTodayOrders = todayTransactions.length - completedTodayOrders;

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

          {/* Bottom Section - Transactions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
            {/* Recent Transactions */}
            <div style={{ backgroundColor: '#fff', borderRadius: '16px', overflow: 'hidden', border: '1px solid #E0D5CB', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              {/* Header */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #E0D5CB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1a1a1a', margin: 0 }}>Recent Transactions</h3>
                <a href="/transactions" style={{ fontSize: '12px', color: '#8B5E3C', fontWeight: '700', textDecoration: 'none', cursor: 'pointer' }}>View All →</a>
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
                transactions.slice(0, 5).map((t, i) => (
                  <TransactionRow
                    key={t._id}
                    receipt={t.receiptNo}
                    items={t.items?.length || 0}
                    amount={t.total || 0}
                    method={t.paymentMethod}
                    time={t.createdAt ? new Date(t.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    status={getTransactionStatus(t, refundMap)}
                  />
                ))
              )}
            </div>

            {/* Quick Actions */}
            <div className="dashboard-actions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <a href="/items" style={{ backgroundColor: '#8B5E3C', color: '#fff', padding: '16px', borderRadius: '12px', textDecoration: 'none', textAlign: 'center', fontWeight: '700', transition: 'all 0.2s', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#6B4423'; e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#8B5E3C'; e.currentTarget.style.transform = 'translateY(0)'; }}><FiPackage /> Start Order</a>
              {isAdmin && (
                <>
                  <a href="/settings" style={{ backgroundColor: '#38A169', color: '#fff', padding: '16px', borderRadius: '12px', textDecoration: 'none', textAlign: 'center', fontWeight: '700', transition: 'all 0.2s', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#2D6A4F'; e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#38A169'; e.currentTarget.style.transform = 'translateY(0)'; }}><FiSettings /> Products</a>
                  <a href="/inventory" style={{ backgroundColor: '#D69E2E', color: '#fff', padding: '16px', borderRadius: '12px', textDecoration: 'none', textAlign: 'center', fontWeight: '700', transition: 'all 0.2s', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#A97D1A'; e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#D69E2E'; e.currentTarget.style.transform = 'translateY(0)'; }}><FiBarChart2 /> Inventory</a>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
