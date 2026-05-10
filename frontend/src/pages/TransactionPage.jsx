import React, { useCallback, useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import ReceiptViewModal from '../components/ReceiptViewModal';
import { FiRefreshCw } from 'react-icons/fi';

const TRANSACTION_REFRESH_MS = 5000;

const buildDateTimeParam = (date, time, isEnd = false) => {
  if (!date) return '';
  if (time) return `${date}T${time}:${isEnd ? '59.999' : '00'}+08:00`;
  return `${date}T${isEnd ? '23:59:59.999' : '00:00:00'}+08:00`;
};

const money = (value) => `PHP ${(Number(value) || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
const isCancelledTransaction = (transaction) => transaction?.orderStatus === 'cancelled' || transaction?.paymentMethod === 'Cancelled';
const buildReceiptProps = (transaction) => ({
  receiptNo: transaction.receiptNo,
  orderNo: transaction.orderNo,
  serviceType: transaction.serviceType,
  cart: (transaction.items || []).map(item => ({
    ...item,
    price: Number(item.price) || 0,
    quantity: Number(item.quantity) || 0,
    discountEligibleQuantity: Number(item.discountEligibleQuantity) || 0,
  })),
  subtotal: Number(transaction.subtotal) || 0,
  discount: Number(transaction.discount) || 0,
  total: Number(transaction.total) || 0,
  paymentMethod: transaction.paymentMethod,
  amountTendered: Number(transaction.amountTendered) || 0,
  change: Number(transaction.change) || 0,
  gcashReference: transaction.gcashReference,
  cashier: transaction.cashier,
  customerType: transaction.customerType,
  eliteMember: transaction.eliteMember,
  discountInfo: transaction.discountInfo,
  createdAt: transaction.createdAt,
});

const TransactionDetailsModal = ({ transaction, onClose, formatDate }) => {
  const [proofPreviewOpen, setProofPreviewOpen] = useState(false);
  const [proofZoom, setProofZoom] = useState(1);

  if (!transaction) return null;

  const items = transaction.items || [];
  const isCancelled = isCancelledTransaction(transaction);
  const totalItems = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const discountLabel = transaction.discountInfo?.name
    ? `${transaction.discountInfo.name} ${Number(transaction.discountInfo.percentage || 0).toLocaleString()}%`
    : '';

  return (
    <>
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(26, 18, 8, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '18px',
        zIndex: 1400,
      }}
    >
      <div
        onClick={event => event.stopPropagation()}
        style={{
          width: 'min(680px, 100%)',
          maxHeight: '88vh',
          overflow: 'auto',
          backgroundColor: '#fff',
          borderRadius: '12px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.26)',
          fontFamily: 'Segoe UI, sans-serif',
        }}
      >
        <div style={{ padding: '22px 24px', borderBottom: '1px solid #E8DDD0', display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: '0 0 5px', fontSize: '11px', color: '#8B5E3C', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Transaction Slip Details
            </p>
            <h2 style={{ margin: 0, fontSize: '21px', color: '#1a1a1a', fontWeight: '900' }}>
              {transaction.receiptNo}
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#777' }}>
              {formatDate(transaction.createdAt)} · {transaction.cashier || 'Unknown cashier'}
            </p>
          </div>
          <button
            onClick={onClose}
            title="Close"
            style={{
              width: '34px',
              height: '34px',
              border: '1px solid #E0D5CB',
              borderRadius: '8px',
              backgroundColor: '#fff',
              color: '#7A6A5A',
              fontSize: '18px',
              fontWeight: '900',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            x
          </button>
        </div>

        <div style={{ padding: '18px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', borderBottom: '1px solid #F0E8E0' }}>
          {[
            ['Payment', transaction.paymentMethod || '-'],
            ['Status', isCancelled ? 'Cancelled' : 'Completed'],
            ['Service', transaction.serviceType || 'Dine In'],
            ['Items', totalItems.toLocaleString()],
            ['Subtotal', money(transaction.subtotal)],
            ['Discount', money(transaction.discount)],
            ...(discountLabel ? [['Discount Type', discountLabel]] : []),
            ['Tax', money(transaction.tax)],
            ['Total', money(transaction.total)],
          ].map(([label, value]) => (
            <div key={label} style={{ backgroundColor: '#FAFAF8', border: '1px solid #E8DDD0', borderRadius: '8px', padding: '10px 12px' }}>
              <p style={{ margin: '0 0 4px', fontSize: '10px', color: '#8B5E3C', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                {label}
              </p>
              <p style={{ margin: 0, fontSize: '13px', color: label === 'Total' ? '#8B5E3C' : '#1a1a1a', fontWeight: '900' }}>
                {value}
              </p>
            </div>
          ))}
        </div>

        <div style={{ padding: '20px 24px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: '900', color: '#1a1a1a' }}>
            Ordered Products
          </h3>

          {items.length === 0 ? (
            <div style={{ padding: '28px', textAlign: 'center', color: '#999', backgroundColor: '#FAFAF8', borderRadius: '8px' }}>
              No products recorded for this transaction.
            </div>
          ) : (
            <div style={{ border: '1px solid #E8DDD0', borderRadius: '8px', overflow: 'hidden' }}>
              {items.map((item, index) => (
                (() => {
                  const refundedQuantity = Number(item.refundedQuantity || 0);
                  const isFullyRefunded = refundedQuantity >= Number(item.quantity || 0) && refundedQuantity > 0;
                  return (
                <div
                  key={`${item.productId || item.name}-${index}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) 70px 110px',
                    gap: '12px',
                    padding: '13px 14px',
                    borderBottom: index === items.length - 1 ? 'none' : '1px solid #F0E8E0',
                    backgroundColor: isFullyRefunded ? '#FFF5F5' : index % 2 === 0 ? '#fff' : '#FAFAF8',
                    alignItems: 'start',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: '900', color: '#1a1a1a' }}>
                      {item.name || 'Unknown product'}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#777', lineHeight: 1.45 }}>
                      {[item.category, item.size, item.selectedVariant].filter(Boolean).join(' · ') || 'Regular'}
                    </p>
                    {item.upgrades?.length > 0 && (
                      <p style={{ margin: '5px 0 0', fontSize: '11px', color: '#8B5E3C', lineHeight: 1.45, fontWeight: '700' }}>
                        Add-ons: {item.upgrades.map(upgrade => `${upgrade.name}${upgrade.price ? ` (+${money(upgrade.price)})` : ''}`).join(', ')}
                      </p>
                    )}
                    {transaction.customerType === 'pwd_senior' && item.discountEligibleQuantity > 0 && (
                      <p style={{ margin: '5px 0 0', fontSize: '11px', color: '#975A16', lineHeight: 1.45, fontWeight: '800' }}>
                        PWD/Senior discount qty: {item.discountEligibleQuantity}
                      </p>
                    )}
                    {refundedQuantity > 0 && (
                      <p style={{ margin: '5px 0 0', fontSize: '11px', color: '#C53030', lineHeight: 1.45, fontWeight: '900' }}>
                        Refunded qty: {refundedQuantity}
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '12px', color: '#555', fontWeight: '800' }}>
                    {item.quantity || 0} x
                    <br />
                    <span style={{ color: '#999', fontWeight: '700' }}>{money(item.price)}</span>
                  </div>
                  <p style={{ margin: 0, textAlign: 'right', fontSize: '13px', color: '#8B5E3C', fontWeight: '900' }}>
                    {money(item.subtotal || ((item.price || 0) * (item.quantity || 0)))}
                  </p>
                </div>
                  );
                })()
              ))}
            </div>
          )}

          {transaction.gcashReference && (
            <div style={{ marginTop: '14px', padding: '12px', backgroundColor: '#F5F0EB', borderRadius: '8px', fontSize: '12px', color: '#6F4A2F', fontWeight: '800' }}>
              GCash reference: {transaction.gcashReference}
            </div>
          )}
          {isCancelled && (
            <div style={{ marginTop: '14px', padding: '12px', backgroundColor: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: '8px', fontSize: '12px', color: '#9B2C2C', fontWeight: '800' }}>
              Cancelled checkout: {transaction.cancelReason || 'No reason recorded'}
            </div>
          )}
          {transaction.paymentMethod === 'GCash' && transaction.gcashProofImage && (
            <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#FAFAF8', border: '1px solid #E8DDD0', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#8B5E3C', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                GCash Payment Proof
              </p>
              <button
                type="button"
                onClick={() => {
                  setProofZoom(1);
                  setProofPreviewOpen(true);
                }}
                style={{ display: 'block', width: '100%', padding: 0, border: 0, background: 'transparent', cursor: 'zoom-in' }}
                title="View GCash proof"
              >
                <img
                  src={transaction.gcashProofImage}
                  alt="GCash payment proof"
                  style={{ width: '100%', maxHeight: '360px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #E0D5CB', backgroundColor: '#fff' }}
                />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    {proofPreviewOpen && (
      <div
        onClick={() => {
          setProofPreviewOpen(false);
          setProofZoom(1);
        }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1600,
          backgroundColor: 'rgba(0,0,0,0.78)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '18px',
        }}
      >
        <div
          onClick={event => event.stopPropagation()}
          style={{
            width: 'min(96vw, 1080px)',
            maxHeight: '92vh',
            display: 'grid',
            gridTemplateRows: 'auto minmax(0, 1fr)',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setProofZoom(zoom => Math.max(0.5, Number((zoom - 0.25).toFixed(2))))}
                style={{ padding: '9px 13px', border: '1px solid rgba(255,255,255,0.35)', borderRadius: '8px', backgroundColor: 'rgba(26,26,26,0.75)', color: '#fff', fontSize: '14px', fontWeight: '900', cursor: 'pointer' }}
              >
                -
              </button>
              <span style={{ minWidth: '56px', textAlign: 'center', color: '#fff', fontSize: '13px', fontWeight: '900' }}>
                {Math.round(proofZoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setProofZoom(zoom => Math.min(3, Number((zoom + 0.25).toFixed(2))))}
                style={{ padding: '9px 13px', border: '1px solid rgba(255,255,255,0.35)', borderRadius: '8px', backgroundColor: 'rgba(26,26,26,0.75)', color: '#fff', fontSize: '14px', fontWeight: '900', cursor: 'pointer' }}
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setProofZoom(1)}
                style={{ padding: '9px 13px', border: '1px solid rgba(255,255,255,0.35)', borderRadius: '8px', backgroundColor: 'rgba(26,26,26,0.75)', color: '#fff', fontSize: '13px', fontWeight: '900', cursor: 'pointer' }}
              >
                Reset
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setProofPreviewOpen(false);
                setProofZoom(1);
              }}
              title="Close proof preview"
              style={{
                width: '40px',
                height: '40px',
                border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: '8px',
                backgroundColor: 'rgba(26,26,26,0.75)',
                color: '#fff',
                fontSize: '20px',
                fontWeight: '900',
                cursor: 'pointer',
              }}
            >
              x
            </button>
          </div>
          <div style={{ overflow: 'auto', borderRadius: '8px', backgroundColor: '#111', boxShadow: '0 24px 70px rgba(0,0,0,0.4)', textAlign: 'center' }}>
            <img
              src={transaction.gcashProofImage}
              alt="GCash payment proof full preview"
              style={{
                display: 'inline-block',
                width: `${proofZoom * 100}%`,
                maxWidth: 'none',
                height: 'auto',
                objectFit: 'contain',
                backgroundColor: '#fff',
                transformOrigin: 'top left',
              }}
            />
          </div>
        </div>
      </div>
    )}
    </>
  );
};

const TransactionPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailsTransaction, setDetailsTransaction] = useState(null);
  const [receiptTransaction, setReceiptTransaction] = useState(null);
  const [filterCashier, setFilterCashier] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterStartTime, setFilterStartTime] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterEndTime, setFilterEndTime] = useState('');

  const fetchTransactions = useCallback(async (overrides = null, options = {}) => {
    const { silent = false } = options;
    const filters = overrides || {
      cashier: filterCashier,
      payment: filterPayment,
      startDate: filterStartDate,
      startTime: filterStartTime,
      endDate: filterEndDate,
      endTime: filterEndTime,
    };

    if (!silent) {
      setLoading(true);
    }
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.cashier) params.append('cashier', filters.cashier);
      if (filters.payment) params.append('paymentMethod', filters.payment);

      const startDateTime = buildDateTimeParam(filters.startDate, filters.startTime);
      const endDateTime = buildDateTimeParam(filters.endDate, filters.endTime, true);
      if (startDateTime) params.append('startDate', startDateTime);
      if (endDateTime) params.append('endDate', endDateTime);

      const res = await fetch(`http://localhost:5000/api/transactions?${params}`);
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const data = await res.json();
      setTransactions(data.data || data);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Failed to load transactions');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [filterCashier, filterPayment, filterStartDate, filterStartTime, filterEndDate, filterEndTime]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (!document.hidden) {
        fetchTransactions(null, { silent: true });
      }
    };

    const refreshTimer = setInterval(refreshWhenVisible, TRANSACTION_REFRESH_MS);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);

    return () => {
      clearInterval(refreshTimer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
    };
  }, [fetchTransactions]);

  const clearFilters = () => {
    setFilterCashier('');
    setFilterPayment('');
    setFilterStartDate('');
    setFilterStartTime('');
    setFilterEndDate('');
    setFilterEndTime('');
    fetchTransactions({
      cashier: '',
      payment: '',
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
    });
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="mobile-app-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#F5F0EB' }}>
      <Sidebar />

      <div className="mobile-page-content" style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
        <PageHeader
          title="Transaction History"
          description="View completed and cancelled orders."
        />

        {/* Filters */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}>
          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '12px', color: '#666' }}>
              Filter by Cashier
            </label>
            <input
              type="text"
              value={filterCashier}
              onChange={(e) => setFilterCashier(e.target.value)}
              placeholder="Enter cashier name"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1.5px solid #D4B89A',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '12px', color: '#666' }}>
              Filter by Payment Method
            </label>
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1.5px solid #D4B89A',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            >
              <option value="">All Methods</option>
              <option value="Cash">Cash</option>
              <option value="GCash">GCash</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '12px', color: '#666' }}>
              Start Date
            </label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1.5px solid #D4B89A',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '12px', color: '#666' }}>
              Start Time
            </label>
            <input
              type="time"
              value={filterStartTime}
              onChange={(e) => setFilterStartTime(e.target.value)}
              disabled={!filterStartDate}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1.5px solid #D4B89A',
                fontSize: '13px',
                boxSizing: 'border-box',
                opacity: filterStartDate ? 1 : 0.55,
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '12px', color: '#666' }}>
              End Date
            </label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1.5px solid #D4B89A',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '12px', color: '#666' }}>
              End Time
            </label>
            <input
              type="time"
              value={filterEndTime}
              onChange={(e) => setFilterEndTime(e.target.value)}
              disabled={!filterEndDate}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1.5px solid #D4B89A',
                fontSize: '13px',
                boxSizing: 'border-box',
                opacity: filterEndDate ? 1 : 0.55,
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <button
              onClick={() => fetchTransactions()}
              style={{
                width: 'fit-content',
                minWidth: '128px',
                height: '40px',
                padding: '0 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#8B5E3C',
                color: '#fff',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                lineHeight: 1,
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#6F4A2F')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#8B5E3C')}
            >
              <FiRefreshCw size={16} /> Apply Filters
            </button>
            <button
              onClick={clearFilters}
              style={{
                width: 'fit-content',
                minWidth: '72px',
                height: '41px',
                padding: '0 12px',
                borderRadius: '6px',
                border: '1.5px solid #D4B89A',
                backgroundColor: '#fff',
                color: '#8B5E3C',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                lineHeight: 1,
              }}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            backgroundColor: '#FEE',
            color: '#C53030',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '16px',
            border: '1px solid #C53030',
          }}>
            {error}
          </div>
        )}

        {/* Transactions Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#666' }}>
            Loading transactions...
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#999' }}>
            No transactions found
          </div>
        ) : (
          <div style={{
            backgroundColor: '#fff',
            border: '1.5px solid #D4B89A',
            borderRadius: '8px',
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#F5F0EB' }}>
                  {['Date', 'Slip No', 'Items', 'Total', 'Cashier', 'Payment', 'Status', 'Action'].map(h => (
                    <th
                      key={h}
                      style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#1a1a1a',
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        borderBottom: '2px solid #1a1a1a',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction, idx) => (
                  <tr
                    key={transaction._id || transaction.receiptNo || idx}
                    onClick={() => setDetailsTransaction(transaction)}
                    title="View ordered products"
                    style={{
                      backgroundColor: idx % 2 === 0 ? '#fff' : '#FAFAFA',
                      borderBottom: '1px solid #eee',
                      cursor: 'pointer',
                    }}
                  >
                    <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                      {formatDate(transaction.createdAt)}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#8B5E3C' }}>
                      {transaction.receiptNo}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                      {transaction.items?.length || 0} item{transaction.items?.length !== 1 ? 's' : ''}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '700', color: '#8B5E3C' }}>
                      ₱{transaction.total?.toLocaleString() || '0'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                      {transaction.cashier}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                      <span
                        style={{
                          backgroundColor: transaction.paymentMethod === 'Cash' ? '#E3F2FD' : transaction.paymentMethod === 'GCash' ? '#FCE4EC' : '#FFF5F5',
                          color: transaction.paymentMethod === 'Cash' ? '#1565C0' : transaction.paymentMethod === 'GCash' ? '#C2185B' : '#C53030',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '600',
                        }}
                      >
                        {transaction.paymentMethod}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                      <span
                        style={{
                          backgroundColor: isCancelledTransaction(transaction) ? '#FFF5F5' : '#F0FFF4',
                          color: isCancelledTransaction(transaction) ? '#C53030' : '#276749',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                        }}
                      >
                        {isCancelledTransaction(transaction) ? 'Cancelled' : 'Completed'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '88px 88px', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            setReceiptTransaction(transaction);
                          }}
                          style={{
                            width: '88px',
                            height: '38px',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            border: '1px solid #8B5E3C',
                            backgroundColor: '#fff',
                            color: '#8B5E3C',
                            fontWeight: '700',
                            fontSize: '11px',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#8B5E3C';
                            e.currentTarget.style.color = '#fff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#fff';
                            e.currentTarget.style.color = '#8B5E3C';
                          }}
                        >
                          Receipt
                        </button>
                        <span style={{ width: '88px', textAlign: 'center', color: '#999', fontSize: '12px', fontWeight: '700', lineHeight: 1.2 }}>
                          Final
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TransactionDetailsModal
        transaction={detailsTransaction}
        onClose={() => setDetailsTransaction(null)}
        formatDate={formatDate}
      />
      {receiptTransaction && (
        <ReceiptViewModal
          {...buildReceiptProps(receiptTransaction)}
          closeLabel="Close Receipt"
          onClose={() => setReceiptTransaction(null)}
        />
      )}
    </div>
  );
};

export default TransactionPage;
