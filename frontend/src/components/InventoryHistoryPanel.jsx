import React, { useMemo, useState } from 'react';
import './InventoryHistoryPanel.css';

const types = [
  ['received', 'Stock received'], ['sale', 'Used in sales'], ['adjustment', 'Stock out'],
  ['expired', 'Expired stock'], ['waste', 'Refund waste'],
];
const labels = Object.fromEntries(types);
const legacyTypes = {
  'stock in': 'received', 'stock received': 'received', 'delivery received': 'received',
  'sale deduction': 'sale', 'stock out': 'adjustment',
  'expired stock auto deducted': 'expired', 'deducted (refund waste)': 'waste',
};
const dayKey = value => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
};
const formatDate = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export default function InventoryHistoryPanel({ rows, onRefresh, refreshing = false }) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  // Older API responses contain an action label but no category/direction.
  // Normalize once so filters, counters and table labels use the same values.
  const movements = useMemo(() => rows.map((row, index) => {
    const movementType = labels[row.movementType] ? row.movementType : legacyTypes[String(row.action || '').trim().replace(/\s+/g, ' ').toLowerCase()] || '';
    return { ...row, _id: row._id || `legacy-${index}`, movementType,
      direction: ['in', 'out'].includes(row.direction) ? row.direction : movementType === 'received' ? 'in' : movementType ? 'out' : '' };
  }), [rows]);
  const invalidDates = start && end && start > end;
  const shown = useMemo(() => {
    if (invalidDates) return [];
    const term = search.trim().toLowerCase();
    return movements.filter(row => {
      const day = dayKey(row.date);
      return (!type || row.movementType === type) && (!start || day >= start) && (!end || day <= end)
        && (!term || [row.item, row.reference, row.by, row.reason].some(value => String(value || '').toLowerCase().includes(term)));
    });
  }, [movements, type, search, start, end, invalidDates]);

  return <section className="inventory-history-panel" aria-label="Inventory history">
    <div className="inventory-history-summary">
      {[[null, 'Movement entries'], ...types].map(([key, label]) => <div className="inventory-history-card" role="group" aria-label={label} key={key || 'total'}>
        <span>{label}</span><strong>{(key ? shown.filter(row => row.movementType === key).length : shown.length).toLocaleString()}</strong>
      </div>)}
    </div>
    <div className="inventory-history-box">
      <header className="inventory-history-heading">
        <div><h2>Inventory Movement</h2><p>Received supplies, sales usage, adjustments, expired stock and recorded waste.</p></div>
        <button type="button" onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Refreshing...' : 'Refresh'}</button>
      </header>
      <div className="inventory-history-filters">
        <label className="inventory-history-search">Search<input type="search" placeholder="Ingredient, PO, receipt or staff..." value={search} onChange={event => setSearch(event.target.value)} /></label>
        <label>Movement<select value={type} onChange={event => setType(event.target.value)}><option value="">All movements</option>{types.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Start date<input type="date" value={start} max={end || undefined} onChange={event => setStart(event.target.value)} /></label>
        <label>End date<input type="date" value={end} min={start || undefined} onChange={event => setEnd(event.target.value)} /></label>
        <button type="button" onClick={() => { setSearch(''); setType(''); setStart(''); setEnd(''); }}>Clear</button>
      </div>
      {invalidDates && <p className="inventory-history-error" role="alert">Start date must be on or before end date.</p>}
      <p className="inventory-history-count" aria-live="polite">Showing {shown.length.toLocaleString()} of {rows.length.toLocaleString()} entries</p>
      <div className="data-scroll-box data-scroll-box-dark" role="region" aria-label="Inventory movements" tabIndex={0}>
        <table className="inventory-history-table">
          <thead><tr>{['Date', 'Ingredient', 'Movement', 'Quantity', 'Reference', 'By', 'Reason'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>
            {!shown.length && <tr><td colSpan={7} className="inventory-history-empty">{rows.length ? 'No movements match these filters.' : 'No inventory movements recorded yet.'}</td></tr>}
            {shown.map(row => <tr key={row._id}>
              <td>{formatDate(row.date)}</td>
              <td><strong>{row.item || '-'}</strong></td>
              <td><span className={`inventory-history-tag ${row.direction === 'in' ? 'is-in' : ''}`}>{(labels[row.movementType] || row.action || 'Movement').toUpperCase()}</span></td>
              <td className="inventory-history-quantity">{row.direction === 'in' ? '+' : row.direction === 'out' ? '−' : ''}{row.quantity}</td>
              <td>{row.reference || '-'}</td>
              <td>{row.by || 'System'}</td>
              <td>{row.reason || '-'}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  </section>;
}
