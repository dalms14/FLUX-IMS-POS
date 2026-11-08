import ValidatedForm from '../ValidatedForm';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';
import './RefundModal.css';

const money = cents => `₱${(cents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const newRequestId = () => Array.from(window.crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');

export default function RefundModal({ isOpen, transaction, onClose, onSuccess }) {
  const [sale, setSale] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef(null);
  const pending = useRef(null);
  const busy = useRef(false);

  useEffect(() => {
    if (!isOpen || !transaction?._id) return;
    let active = true;
    setSale(null); setQuantities({}); setReason(''); setError(''); setLoading(true);
    pending.current = null;
    fetch(`http://localhost:5000/api/transactions/${transaction._id}`)
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Could not load this receipt.');
        if (active) setSale(data.data);
      })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOpen, transaction?._id]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement;
    dialog.current?.focus();
    const handleKey = event => {
      if (event.key === 'Escape' && !busy.current) onClose();
      if (event.key !== 'Tab') return;
      const elements = dialog.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)');
      if (!elements?.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); previous?.focus?.(); };
  }, [isOpen, onClose]);

  if (!isOpen || !transaction) return null;
  const selected = index => Object.prototype.hasOwnProperty.call(quantities, index);
  const selections = (sale?.items || []).filter(item => selected(item.originalIndex)).map(item => ({ originalIndex: item.originalIndex, quantity: Number(quantities[item.originalIndex]) }));
  const totalCents = selections.reduce((sum, selection) => {
    const item = sale.items[selection.originalIndex];
    if (!Number.isSafeInteger(selection.quantity) || selection.quantity < 1 || selection.quantity > item.refundableQuantity) return sum;
    const already = item.refundedQuantity || 0;
    const amount = item.refundLineAmounts?.total || 0;
    return sum + Math.round(amount * (already + selection.quantity) / item.quantity) - Math.round(amount * already / item.quantity);
  }, 0);
  const valid = sale?.refundSummary?.canRefund && selections.length > 0 && reason.trim() && reason.length <= 150 && totalCents > 0
    && selections.every(selection => Number.isSafeInteger(selection.quantity) && selection.quantity > 0 && selection.quantity <= sale.items[selection.originalIndex].refundableQuantity);

  const submit = async event => {
    event.preventDefault();
    if (!valid || busy.current) return;
    busy.current = true; setSaving(true); setError('');
    try {
      const payload = { transactionId: sale._id, items: selections, reason: reason.trim() };
      const fingerprint = JSON.stringify(payload);
      if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, requestId: newRequestId() };
      const response = await fetch('http://localhost:5000/api/refunds', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, requestId: pending.current.requestId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not save the refund. Try again.');
      onSuccess?.(data.data);
      onClose();
    } catch (err) { setError(err.message); }
    finally { busy.current = false; setSaving(false); }
  };

  return createPortal(
    <div className="refund-backdrop">
      <section className="refund-dialog" role="dialog" aria-modal="true" aria-labelledby="refund-title" tabIndex={-1} ref={dialog}>
        <header className="refund-header">
          <div><h2 id="refund-title">Refund transaction</h2><p>{transaction.receiptNo}</p></div>
          <button type="button" aria-label="Close refund" onClick={onClose} disabled={saving}><FiX /></button>
        </header>
        <ValidatedForm onSubmit={submit}>
          <div className="refund-body">
            {loading && <p role="status">Loading receipt...</p>}
            {error && <p role="alert" className="refund-error">{error}</p>}
            {sale && <>
              <p>Select the items and quantities to refund.</p>
              {!sale.refundSummary?.canRefund && <p role="status">{sale.refundSummary?.unavailableReason || 'No items are available for refund.'}</p>}
              <div className="refund-items">
                {sale.items.map(item => {
                  const available = item.refundableQuantity || 0;
                  const disabled = saving || !sale.refundSummary?.canRefund || !available || item.reservedRefundQuantity > 0;
                  return <div className="refund-item" key={item.originalIndex}>
                    <label className="refund-item-label">
                      <input type="checkbox" aria-label={`Refund ${item.name} (item ${item.originalIndex + 1})`} disabled={disabled}
                        checked={selected(item.originalIndex)}
                        onChange={event => { const checked = event.target.checked; setQuantities(current => { const next = { ...current }; if (checked) next[item.originalIndex] = 1; else delete next[item.originalIndex]; return next; }); }} />
                      <span><strong>{item.name}</strong><small>{[item.size, item.selectedVariant].filter(Boolean).join(' · ')}</small>
                        <small>{available} available · {item.refundedQuantity || 0} already refunded{item.reservedRefundQuantity ? ' · Pending refund' : ''}</small></span>
                    </label>
                    <input type="number" aria-label={`Refund quantity for ${item.name} (item ${item.originalIndex + 1})`} min="1" max={available} step="1"
                      disabled={disabled || !selected(item.originalIndex)} value={quantities[item.originalIndex] ?? ''}
                      onChange={event => setQuantities(current => ({ ...current, [item.originalIndex]: event.target.value }))} />
                  </div>;
                })}
              </div>
              <label className="refund-reason" htmlFor="refund-reason">Reason for refund</label>
              <textarea id="refund-reason" aria-describedby="refund-reason-limit" value={reason} onChange={event => setReason(event.target.value.slice(0, 150))} required maxLength={150} rows={3}
                placeholder="e.g. Wrong item served" disabled={saving || !sale.refundSummary?.canRefund} />
              <small id="refund-reason-limit" style={{ display: 'block', textAlign: 'right', marginTop: '5px', color: '#78695d' }}>{reason.length}/150 characters</small>
              <div className="refund-total"><strong>Amount to return</strong><strong>{money(totalCents)}</strong></div>
              <p className="refund-note">Includes the original discount. Return the amount through {sale.paymentMethod}. This records the refund; it does not send a payment or return stock automatically.</p>
            </>}
          </div>
          <footer className="refund-actions">
            <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" disabled={!valid || loading || saving}>{saving ? 'Saving...' : 'Confirm refund'}</button>
          </footer>
        </ValidatedForm>
      </section>
    </div>, document.body);
}
