import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import { FiBarChart2, FiCreditCard, FiDollarSign, FiDownload, FiRefreshCw, FiShoppingBag } from 'react-icons/fi';

const salesAnimationStyleId = 'sales-page-animations';
if (typeof document !== 'undefined') {
  let style = document.getElementById(salesAnimationStyleId);
  if (!style) {
    style = document.createElement('style');
    style.id = salesAnimationStyleId;
    document.head.appendChild(style);
  }
  style.textContent = `
    @keyframes salesLineDraw {
      from { stroke-dashoffset: 1; opacity: 0.15; }
      to { stroke-dashoffset: 0; opacity: 1; }
    }

    @keyframes salesPointPop {
      0%, 45% { transform: scale(0); opacity: 0; }
      75% { transform: scale(1.35); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }

    @keyframes salesGridFade {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes paymentBarFill {
      from { transform: scaleX(0); }
      to { transform: scaleX(1); }
    }

    .sales-trend-grid {
      animation: salesGridFade 520ms ease-out both;
    }

    .sales-trend-line {
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
      animation: salesLineDraw 1100ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }

    .sales-trend-point {
      transform-box: fill-box;
      transform-origin: center;
      animation: salesPointPop 780ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    .payment-mix-fill {
      transform-origin: left center;
      animation: paymentBarFill 820ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }
  `;
}

const today = new Date();
const toDateInput = (date) => date.toISOString().slice(0, 10);
const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

const presets = {
  today: { label: 'Today', start: toDateInput(today), end: toDateInput(today) },
  month: { label: 'This Month', start: toDateInput(startOfMonth), end: toDateInput(today) },
  all: { label: 'All Time', start: '', end: '' },
};

const money = (value) => `PHP ${(Number(value) || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
const isCancelledTransaction = (transaction) => transaction?.orderStatus === 'cancelled' || transaction?.paymentMethod === 'Cancelled';

const formatHourRange = (hour) => {
  if (!Number.isFinite(hour)) return 'No sales yet';
  const start = new Date();
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start);
  end.setHours(hour + 1);
  return `${start.toLocaleTimeString('en-PH', { hour: 'numeric', hour12: true })} - ${end.toLocaleTimeString('en-PH', { hour: 'numeric', hour12: true })}`;
};

const cardStyle = {
  backgroundColor: '#fff',
  border: '1px solid #E0D5CB',
  borderRadius: '8px',
  padding: '18px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
};

const thStyle = {
  padding: '12px 14px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: '800',
  color: '#6F4A2F',
  textTransform: 'uppercase',
  letterSpacing: '0.7px',
  borderBottom: '2px solid #E0D5CB',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '12px 14px',
  fontSize: '13px',
  color: '#333',
  borderBottom: '1px solid #F0E8E0',
};

const productSalesColumns = [
  { key: 'name', label: 'Product', type: 'text' },
  { key: 'category', label: 'Category', type: 'text' },
  { key: 'quantity', label: 'Sold', type: 'number' },
  { key: 'refundedQty', label: 'Refunded', type: 'number' },
  { key: 'netQty', label: 'Net Qty', type: 'number' },
  { key: 'gross', label: 'Gross Sales', type: 'number' },
];

const metricColors = {
  netSales: '#276749',
  orders: '#8B5E3C',
  avgOrder: '#2B6CB0',
  refunds: '#C53030',
};

const formatTrendLabel = (value) => {
  if (!value) return '';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
};

const MetricCard = ({ title, value, detail, icon, color }) => (
  <div style={cardStyle}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
      <div>
        <p style={{ margin: '0 0 7px', fontSize: '11px', color: '#777', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.7px' }}>{title}</p>
        <p style={{ margin: 0, fontSize: '25px', color, fontWeight: '900' }}>{value}</p>
      </div>
      <div style={{ width: '42px', height: '42px', borderRadius: '8px', backgroundColor: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
        {icon}
      </div>
    </div>
    {detail && <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#999' }}>{detail}</p>}
  </div>
);

const SalesTrendChart = ({ data }) => {
  const [tooltip, setTooltip] = useState(null);
  const width = 760;
  const height = 300;
  const padding = { top: 28, right: 28, bottom: 42, left: 38 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const series = [
    { key: 'netSales', label: 'Net Sales', color: metricColors.netSales },
    { key: 'orders', label: 'Orders', color: metricColors.orders },
    { key: 'avgOrder', label: 'Average Order', color: metricColors.avgOrder },
    { key: 'refunds', label: 'Refunds', color: metricColors.refunds },
  ];
  const safeData = data.length > 0 ? data : [{ date: toDateInput(new Date()), netSales: 0, orders: 0, avgOrder: 0, refunds: 0 }];
  const animationKey = safeData.map(row => [
    row.date,
    row.netSales,
    row.orders,
    row.avgOrder,
    row.refunds,
  ].join(':')).join('|');
  const xFor = (index) => padding.left + (safeData.length === 1 ? chartWidth / 2 : (index / (safeData.length - 1)) * chartWidth);
  const yFor = (value, max) => padding.top + chartHeight - ((max > 0 ? value / max : 0) * chartHeight);

  const buildPath = (key) => {
    const max = Math.max(...safeData.map(row => Number(row[key]) || 0), 1);
    return safeData
      .map((row, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index)} ${yFor(Number(row[key]) || 0, max)}`)
      .join(' ');
  };

  const formatMetricValue = (key, value) => (
    key === 'orders'
      ? (Number(value) || 0).toLocaleString('en-PH')
      : money(value)
  );

  const xLabels = safeData.length <= 6
    ? safeData
    : safeData.filter((_, index) => index === 0 || index === safeData.length - 1 || index % Math.ceil(safeData.length / 4) === 0);
  const peakDay = safeData.reduce((best, row) => (
    (Number(row.netSales) || 0) > (Number(best.netSales) || 0) ? row : best
  ), safeData[0]);

  return (
    <div style={{ ...cardStyle, padding: '18px', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#1a1a1a' }}>Sales Trend</h2>
          <p style={{ margin: '5px 0 0', fontSize: '11px', color: '#999' }}>Daily comparison by metric</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {series.map(item => (
            <span key={item.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#666', fontWeight: '800' }}>
              <span style={{ width: '18px', height: '3px', borderRadius: '999px', backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div style={{ width: '100%', overflow: 'hidden' }}>
        <svg
          key={animationKey}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Sales trend line chart"
          onMouseLeave={() => setTooltip(null)}
          style={{ width: '100%', height: 'clamp(240px, 30vw, 330px)', display: 'block' }}
        >
          <g className="sales-trend-grid">
            {[0, 1, 2, 3, 4].map(step => {
              const y = padding.top + (step / 4) * chartHeight;
              return (
                <line key={step} x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#F0E8E0" strokeWidth="1" />
              );
            })}
            <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartHeight} stroke="#E0D5CB" strokeWidth="1.2" />
            <line x1={padding.left} y1={padding.top + chartHeight} x2={width - padding.right} y2={padding.top + chartHeight} stroke="#E0D5CB" strokeWidth="1.2" />
          </g>

          {series.map((item, index) => (
            <path
              key={item.key}
              className="sales-trend-line"
              d={buildPath(item.key)}
              fill="none"
              stroke={item.color}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength="1"
              style={{ animationDelay: `${index * 120}ms` }}
            />
          ))}

          {series.map((item, seriesIndex) => {
            const max = Math.max(...safeData.map(row => Number(row[item.key]) || 0), 1);
            return safeData.map((row, index) => (
              <circle
                key={`${item.key}-${row.date}-${index}`}
                className="sales-trend-point"
                cx={xFor(index)}
                cy={yFor(Number(row[item.key]) || 0, max)}
                r="3.5"
                fill="#fff"
                stroke={item.color}
                strokeWidth="2"
                onMouseEnter={() => setTooltip({
                  x: xFor(index),
                  y: yFor(Number(row[item.key]) || 0, max),
                  color: item.color,
                  label: item.label,
                  date: formatTrendLabel(row.date),
                  value: formatMetricValue(item.key, row[item.key]),
                })}
                onMouseMove={() => setTooltip({
                  x: xFor(index),
                  y: yFor(Number(row[item.key]) || 0, max),
                  color: item.color,
                  label: item.label,
                  date: formatTrendLabel(row.date),
                  value: formatMetricValue(item.key, row[item.key]),
                })}
                style={{ animationDelay: `${360 + seriesIndex * 90 + index * 45}ms` }}
              />
            ));
          })}

          {tooltip && (
            <g pointerEvents="none">
              <line x1={tooltip.x} y1={padding.top} x2={tooltip.x} y2={padding.top + chartHeight} stroke={tooltip.color} strokeWidth="1.4" strokeDasharray="4 5" opacity="0.35" />
              <circle cx={tooltip.x} cy={tooltip.y} r="7" fill={tooltip.color} opacity="0.16" />
              <circle cx={tooltip.x} cy={tooltip.y} r="4" fill="#fff" stroke={tooltip.color} strokeWidth="2.4" />
              <g transform={`translate(${Math.min(Math.max(tooltip.x - 76, padding.left), width - padding.right - 152)}, ${Math.max(tooltip.y - 78, padding.top + 8)})`}>
                <rect width="152" height="58" rx="8" fill="#1A1208" opacity="0.94" />
                <circle cx="14" cy="17" r="4" fill={tooltip.color} />
                <text x="24" y="21" fontSize="11" fontWeight="900" fill="#F5EDE3">{tooltip.label}</text>
                <text x="12" y="38" fontSize="10" fontWeight="700" fill="#C4B5A5">{tooltip.date}</text>
                <text x="12" y="51" fontSize="12" fontWeight="900" fill="#fff">{tooltip.value}</text>
              </g>
            </g>
          )}

          {xLabels.map((row, index) => {
            const realIndex = safeData.findIndex(item => item.date === row.date);
            return (
              <text key={`${row.date}-${index}`} x={xFor(realIndex)} y={height - 14} textAnchor="middle" fontSize="11" fontWeight="700" fill="#8A7A6B">
                {formatTrendLabel(row.date)}
              </text>
            );
          })}
        </svg>
      </div>
      <div style={{ marginTop: '12px', padding: '12px 14px', border: '1px solid #E0D5CB', borderRadius: '8px', backgroundColor: '#FAFAF8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px' }}>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: '10px', color: '#777', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Peak Day</p>
          <p style={{ margin: 0, fontSize: '15px', color: '#1a1a1a', fontWeight: '900' }}>{formatTrendLabel(peakDay.date)}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: '0 0 4px', fontSize: '10px', color: '#777', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Net Sales</p>
          <p style={{ margin: 0, fontSize: '15px', color: metricColors.netSales, fontWeight: '900' }}>{money(peakDay.netSales)}</p>
        </div>
      </div>
    </div>
  );
};

const SalesPage = () => {
  const [preset, setPreset] = useState('today');
  const [startDate, setStartDate] = useState(presets.today.start);
  const [endDate, setEndDate] = useState(presets.today.end);
  const [transactions, setTransactions] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [productSort, setProductSort] = useState({ key: 'gross', direction: 'desc' });

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return params.toString();
  }, [startDate, endDate]);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = buildParams();
      const [transactionRes, refundRes] = await Promise.all([
        axios.get(`http://localhost:5000/api/transactions${query ? `?${query}` : ''}`),
        axios.get(`http://localhost:5000/api/refunds${query ? `?${query}` : ''}`),
      ]);
      setTransactions(transactionRes.data.data || transactionRes.data || []);
      setRefunds(refundRes.data.data || refundRes.data || []);
    } catch (err) {
      console.error('Error fetching sales:', err);
      setError('Failed to load sales data.');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const applyPreset = (key) => {
    setPreset(key);
    setStartDate(presets[key].start);
    setEndDate(presets[key].end);
  };

  const activeRefunds = useMemo(
    () => refunds.filter(refund => ['approved', 'completed'].includes(refund.status)),
    [refunds]
  );

  const salesTrend = useMemo(() => {
    const buckets = new Map();
    const ensureBucket = (dateValue) => {
      const date = dateValue ? new Date(dateValue) : new Date();
      const key = Number.isNaN(date.getTime()) ? toDateInput(new Date()) : toDateInput(date);
      const current = buckets.get(key) || {
        date: key,
        grossSales: 0,
        refunds: 0,
        netSales: 0,
        orders: 0,
        avgOrder: 0,
      };
      buckets.set(key, current);
      return current;
    };

    transactions.filter(transaction => !isCancelledTransaction(transaction)).forEach(transaction => {
      const bucket = ensureBucket(transaction.createdAt);
      bucket.grossSales += transaction.total || 0;
      bucket.orders += 1;
    });

    activeRefunds.forEach(refund => {
      const bucket = ensureBucket(refund.createdAt);
      bucket.refunds += refund.totalRefunded || 0;
    });

    if (buckets.size === 0) {
      const fallback = ensureBucket(startDate || new Date());
      fallback.netSales = 0;
      return [fallback];
    }

    return Array.from(buckets.values())
      .map(bucket => ({
        ...bucket,
        netSales: bucket.grossSales - bucket.refunds,
        avgOrder: bucket.orders > 0 ? bucket.grossSales / bucket.orders : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [transactions, activeRefunds, startDate]);

  const sales = useMemo(() => {
    const salesTransactions = transactions.filter(transaction => !isCancelledTransaction(transaction));
    const grossSales = salesTransactions.reduce((sum, transaction) => sum + (transaction.total || 0), 0);
    const refundTotal = activeRefunds.reduce((sum, refund) => sum + (refund.totalRefunded || 0), 0);
    const itemCount = salesTransactions.reduce((sum, transaction) => (
      sum + (transaction.items || []).reduce((itemSum, item) => itemSum + (item.quantity || 0), 0)
    ), 0);
    const avgOrder = salesTransactions.length > 0 ? grossSales / salesTransactions.length : 0;

    const byPayment = salesTransactions.reduce((map, transaction) => {
      const method = transaction.paymentMethod || 'Unknown';
      const current = map.get(method) || { method, orders: 0, total: 0 };
      current.orders += 1;
      current.total += transaction.total || 0;
      map.set(method, current);
      return map;
    }, new Map());

    const refundQtyByKey = activeRefunds.reduce((map, refund) => {
      (refund.items || []).forEach(item => {
        const key = String(item.productId?._id || item.productId || item.name);
        map.set(key, (map.get(key) || 0) + (item.quantity || 0));
      });
      return map;
    }, new Map());

    const products = salesTransactions.reduce((map, transaction) => {
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
    }, new Map());

    const peakSalesHour = Array.from(salesTransactions.reduce((map, transaction) => {
      const date = new Date(transaction.createdAt);
      if (Number.isNaN(date.getTime())) return map;
      const hour = date.getHours();
      const current = map.get(hour) || { hour, orders: 0, gross: 0 };
      current.orders += 1;
      current.gross += transaction.total || 0;
      map.set(hour, current);
      return map;
    }, new Map()).values()).sort((a, b) => b.gross - a.gross || b.orders - a.orders)[0] || null;

    const productRows = Array.from(products.values())
      .map(product => ({
        ...product,
        refundedQty: refundQtyByKey.get(product.key) || 0,
      }))
      .map(product => ({
        ...product,
        netQty: Math.max(product.quantity - product.refundedQty, 0),
      }))
      .sort((a, b) => b.gross - a.gross);

    return {
      grossSales,
      refundTotal,
      netSales: grossSales - refundTotal,
      orders: salesTransactions.length,
      itemCount,
      avgOrder,
      peakSalesHour,
      paymentRows: Array.from(byPayment.values()).sort((a, b) => b.total - a.total),
      productRows,
    };
  }, [transactions, activeRefunds]);

  const sortedProductRows = useMemo(() => {
    const column = productSalesColumns.find(item => item.key === productSort.key) || productSalesColumns[5];
    const directionFactor = productSort.direction === 'asc' ? 1 : -1;

    return [...sales.productRows].sort((a, b) => {
      const aValue = a[column.key];
      const bValue = b[column.key];

      if (column.type === 'number') {
        return ((Number(aValue) || 0) - (Number(bValue) || 0)) * directionFactor;
      }

      return String(aValue || '').localeCompare(String(bValue || '')) * directionFactor;
    });
  }, [sales.productRows, productSort]);

  const handleProductSort = (key) => {
    setProductSort(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const exportCsv = () => {
    const rows = [
      ['Product', 'Category', 'Qty Sold', 'Qty Refunded', 'Net Qty', 'Gross Sales'],
      ...sortedProductRows.map(row => [row.name, row.category, row.quantity, row.refundedQty, row.netQty, row.gross]),
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales-${startDate || 'all'}-${endDate || 'all'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mobile-app-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#F5F0EB' }}>
      <Sidebar />

      <main className="mobile-page-content" style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
        <PageHeader
          title="Sales"
          description="Revenue, refunds, payment mix, and product performance."
          actions={
          <button
            onClick={exportCsv}
            disabled={sales.productRows.length === 0}
            style={{ padding: '10px 14px', border: 'none', borderRadius: '8px', backgroundColor: sales.productRows.length === 0 ? '#bbb' : '#1A1208', color: '#fff', fontWeight: '800', cursor: sales.productRows.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <FiDownload size={15} /> Export CSV
          </button>
          }
        />

        <section style={{ ...cardStyle, marginBottom: '20px', padding: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '7px', fontSize: '11px', color: '#666', fontWeight: '800', textTransform: 'uppercase' }}>Preset</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {Object.entries(presets).map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() => applyPreset(key)}
                    style={{ padding: '9px 12px', borderRadius: '7px', border: '1px solid #D4B89A', backgroundColor: preset === key ? '#8B5E3C' : '#fff', color: preset === key ? '#fff' : '#6F4A2F', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
                  >
                    {value.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '7px', fontSize: '11px', color: '#666', fontWeight: '800', textTransform: 'uppercase' }}>Start Date</label>
              <input type="date" value={startDate} onChange={e => { setPreset('custom'); setStartDate(e.target.value); }} style={{ width: '100%', padding: '10px', border: '1px solid #D4B89A', borderRadius: '7px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '7px', fontSize: '11px', color: '#666', fontWeight: '800', textTransform: 'uppercase' }}>End Date</label>
              <input type="date" value={endDate} onChange={e => { setPreset('custom'); setEndDate(e.target.value); }} style={{ width: '100%', padding: '10px', border: '1px solid #D4B89A', borderRadius: '7px', boxSizing: 'border-box' }} />
            </div>
            <button onClick={fetchSales} disabled={loading} style={{ padding: '11px 14px', borderRadius: '8px', border: 'none', backgroundColor: '#8B5E3C', color: '#fff', fontWeight: '800', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <FiRefreshCw size={15} /> {loading ? 'Loading' : 'Apply'}
            </button>
          </div>
        </section>

        {error && <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#FFF5F5', color: '#C53030', border: '1px solid #FED7D7', borderRadius: '8px', fontSize: '13px', fontWeight: '700' }}>{error}</div>}

        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 390px) minmax(0, 1fr)', gap: '18px', alignItems: 'stretch', marginBottom: '20px' }}>
          <div style={{ display: 'grid', gap: '14px' }}>
            <MetricCard title="Net Sales" value={money(sales.netSales)} detail={`${money(sales.grossSales)} gross minus refunds`} icon={<FiDollarSign size={22} />} color={metricColors.netSales} />
            <MetricCard title="Orders" value={sales.orders.toLocaleString()} detail={`${sales.itemCount.toLocaleString()} items sold`} icon={<FiShoppingBag size={22} />} color={metricColors.orders} />
            <MetricCard title="Average Order" value={money(sales.avgOrder)} detail="Gross sales per order" icon={<FiBarChart2 size={22} />} color={metricColors.avgOrder} />
            <MetricCard title="Refunds" value={money(sales.refundTotal)} detail={`${activeRefunds.length} approved or completed`} icon={<FiCreditCard size={22} />} color={metricColors.refunds} />
          </div>
          <SalesTrendChart data={salesTrend} />
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)', gap: '18px' }}>
          <div style={{ ...cardStyle, overflow: 'hidden', padding: 0 }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #E0D5CB' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#1a1a1a' }}>Product Sales</h2>
            </div>
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {productSalesColumns.map(column => {
                      const isActiveSort = productSort.key === column.key;
                      return (
                        <th key={column.key} style={{ ...thStyle, padding: 0 }}>
                          <button
                            type="button"
                            onClick={() => handleProductSort(column.key)}
                            title={`Sort by ${column.label}`}
                            style={{
                              width: '100%',
                              padding: '12px 14px',
                              border: 'none',
                              backgroundColor: isActiveSort ? '#F5F0EB' : 'transparent',
                              color: isActiveSort ? '#8B5E3C' : '#6F4A2F',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                              font: 'inherit',
                              textTransform: 'inherit',
                              letterSpacing: 'inherit',
                              textAlign: 'left',
                            }}
                          >
                            <span>{column.label}</span>
                            <span style={{ fontSize: '10px', opacity: isActiveSort ? 1 : 0.35 }}>
                              {isActiveSort ? (productSort.direction === 'desc' ? '↓' : '↑') : '↕'}
                            </span>
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="6" style={{ ...tdStyle, textAlign: 'center', color: '#999', padding: '32px' }}>Loading sales...</td></tr>
                  ) : sales.productRows.length === 0 ? (
                    <tr><td colSpan="6" style={{ ...tdStyle, textAlign: 'center', color: '#999', padding: '32px' }}>No sales found for this period.</td></tr>
                  ) : (
                    sortedProductRows.map((row, index) => (
                      <tr key={row.key} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                        <td style={{ ...tdStyle, fontWeight: '800', color: '#1a1a1a' }}>{row.name}</td>
                        <td style={tdStyle}>{row.category}</td>
                        <td style={tdStyle}>{row.quantity.toLocaleString()}</td>
                        <td style={{ ...tdStyle, color: row.refundedQty > 0 ? '#C53030' : '#999' }}>{row.refundedQty.toLocaleString()}</td>
                        <td style={{ ...tdStyle, fontWeight: '800' }}>{row.netQty.toLocaleString()}</td>
                        <td style={{ ...tdStyle, color: '#8B5E3C', fontWeight: '900' }}>{money(row.gross)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '18px', alignContent: 'start' }}>
            <div style={cardStyle}>
              <h2 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: '900', color: '#1a1a1a' }}>Payment Mix</h2>
              {sales.paymentRows.length === 0 ? (
                <p style={{ margin: 0, fontSize: '13px', color: '#999' }}>No payments in this period.</p>
              ) : (
                sales.paymentRows.map((row, index) => {
                  const percent = sales.grossSales > 0 ? (row.total / sales.grossSales) * 100 : 0;
                  return (
                    <div key={row.method} style={{ marginBottom: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '7px', fontSize: '13px' }}>
                        <span style={{ fontWeight: '800', color: '#333' }}>{row.method}</span>
                        <span style={{ color: '#8B5E3C', fontWeight: '900' }}>{money(row.total)}</span>
                      </div>
                      <div style={{ height: '8px', backgroundColor: '#F0E8E0', borderRadius: '999px', overflow: 'hidden' }}>
                        <div
                          className="payment-mix-fill"
                          style={{
                            width: `${percent}%`,
                            height: '100%',
                            backgroundColor: row.method === 'Cash' ? '#2B6CB0' : '#C2185B',
                            borderRadius: '999px',
                            animationDelay: `${index * 120}ms`,
                          }}
                        />
                      </div>
                      <p style={{ margin: '5px 0 0', fontSize: '11px', color: '#999' }}>{row.orders} order{row.orders !== 1 ? 's' : ''} · {percent.toFixed(1)}%</p>
                    </div>
                  );
                })
              )}
            </div>

            <div style={cardStyle}>
              <h2 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: '900', color: '#1a1a1a' }}>Peak Sales Hour</h2>
              {sales.peakSalesHour ? (
                <>
                  <p style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '900', color: '#1a1a1a' }}>{formatHourRange(sales.peakSalesHour.hour)}</p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#777' }}>{sales.peakSalesHour.orders} order{sales.peakSalesHour.orders !== 1 ? 's' : ''} - {money(sales.peakSalesHour.gross)}</p>
                </>
              ) : (
                <p style={{ margin: 0, fontSize: '13px', color: '#999' }}>No completed sales yet.</p>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default SalesPage;

