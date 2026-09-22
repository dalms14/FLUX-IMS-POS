import React, { useCallback, useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import {
  FiAlertTriangle,
  FiChevronDown,
  FiMinus,
  FiPackage,
  FiSearch,
  FiTrendingUp,
  FiX,
} from 'react-icons/fi';

const NEAR_EXPIRY_DAYS = 7;

const cardStyle = {
  backgroundColor: '#fff',
  border: '1px solid #E0D5CB',
  borderRadius: '12px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
};

const inputStyle = {
  width: '100%',
  padding: '11px 12px',
  border: '1.5px solid #D8CABB',
  borderRadius: '8px',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'Segoe UI, sans-serif',
  backgroundColor: '#fff',
};

const labelStyle = {
  display: 'block',
  marginBottom: '7px',
  fontSize: '11px',
  color: '#6B5A4C',
  fontWeight: '900',
  textTransform: 'uppercase',
  letterSpacing: '0.7px',
};

const inventoryUnitOptions = [
  { value: 'g', label: 'Grams (g)' },
  { value: 'ml', label: 'Milliliters (ml)' },
  { value: 'pcs', label: 'Pieces (pcs)' },
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'L', label: 'Liters (L)' },
];

const inventoryCategoryOptions = [
  'General',
  'Batter',
  'Bread',
  'Coffee',
  'Dairy',
  'Fruit',
  'Grain',
  'Meat',
  'Oil',
  'Packaging',
  'Pastry',
  'Powder',
  'Sauce',
  'Seafood',
  'Snack',
  'Spice',
  'Syrup',
  'Tea',
  'Topping',
  'Utility',
  'Vegetable',
  'Other',
];

const tableHeaderStyle = {
  margin: 0,
  fontSize: '11px',
  color: '#C4894A',
  fontWeight: '900',
  textTransform: 'uppercase',
  letterSpacing: '0.7px',
};

const formatDateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const normalizeBatchRows = (item) => {
  const batches = Array.isArray(item?.expirationBatches) ? item.expirationBatches : [];
  if (batches.length > 0) {
    const rows = batches.map(batch => ({
      quantity: Number(batch.quantity) || 0,
      expirationDate: formatDateInput(batch.expirationDate),
      note: batch.note || '',
    }));
    const batchTotal = getBatchTotal(rows);
    const stockValue = Number(item?.stock || 0);

    if (stockValue > batchTotal) {
      rows.push({
        quantity: stockValue - batchTotal,
        expirationDate: formatDateInput(item?.expirationDate),
        note: 'Existing stock',
      });
    }

    return rows;
  }

  if (Number(item?.stock || 0) > 0 || item?.expirationDate) {
    return [{
      quantity: Number(item?.stock || 0),
      expirationDate: formatDateInput(item?.expirationDate),
      note: item ? 'Current stock' : 'Opening stock',
    }];
  }

  return [{ quantity: 0, expirationDate: '', note: 'Opening stock' }];
};

const getBatchTotal = (batches = []) => (
  batches.reduce((sum, batch) => sum + (Number(batch.quantity) || 0), 0)
);

const formatDisplayDate = (value) => {
  if (!value) return 'No date set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: '2-digit' });
};

const getExpirationStatus = (item) => {
  if (!item.expirationDate) {
    return { label: 'No Expiry Date', color: '#718096', bg: '#F7FAFC', border: '#E2E8F0', severity: 'none' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(item.expirationDate);
  expiry.setHours(0, 0, 0, 0);

  if (Number.isNaN(expiry.getTime())) {
    return { label: 'Invalid Date', color: '#C53030', bg: '#FFF5F5', border: '#FED7D7', severity: 'expired' };
  }

  const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return { label: 'Expired', color: '#C53030', bg: '#FFF5F5', border: '#FED7D7', severity: 'expired', daysLeft };
  }

  if (daysLeft <= NEAR_EXPIRY_DAYS) {
    return {
      label: daysLeft === 0 ? 'Expires Today' : `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
      color: '#D97706',
      bg: '#FFFAF0',
      border: '#FEEBC8',
      severity: 'near',
      daysLeft,
    };
  }

  return { label: 'Valid', color: '#276749', bg: '#F0FFF4', border: '#C6F6D5', severity: 'valid', daysLeft };
};

const primaryButtonStyle = {
  padding: '11px 14px',
  backgroundColor: '#8B5E3C',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  fontSize: '13px',
  fontWeight: '900',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  whiteSpace: 'nowrap',
};

const secondaryButtonStyle = {
  padding: '11px 14px',
  backgroundColor: '#fff',
  color: '#6F4A2F',
  border: '1px solid #D4B89A',
  borderRadius: '8px',
  fontSize: '13px',
  fontWeight: '900',
  cursor: 'pointer',
};

const CompactChoiceSelect = ({ name, value, options, onChange }) => {
  const [open, setOpen] = useState(false);

  const handleSelect = (nextValue) => {
    onChange({ target: { name, value: nextValue } });
    setOpen(false);
  };

  return (
    <div
      style={{ position: 'relative' }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        style={{
          ...inputStyle,
          height: '43px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          color: '#1a1a1a',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
        <FiChevronDown size={15} style={{ color: '#6B5A4C', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', flexShrink: 0 }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 'calc(100% + 6px)',
            maxHeight: '168px',
            overflowY: 'auto',
            backgroundColor: '#fff',
            border: '1px solid #D8CABB',
            borderRadius: '8px',
            boxShadow: '0 14px 32px rgba(26,18,8,0.16)',
            zIndex: 1002,
            padding: '4px',
          }}
        >
          {options.map(option => {
            const selected = option === value;
            return (
              <button
                key={option}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  handleSelect(option);
                }}
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: selected ? '#8B5E3C' : '#fff',
                  color: selected ? '#fff' : '#1a1a1a',
                  fontSize: '13px',
                  fontFamily: 'Segoe UI, sans-serif',
                  fontWeight: selected ? '800' : '500',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                {option}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const KPICard = ({ title, value, detail, icon, color }) => (
  <div style={{ ...cardStyle, padding: '16px' }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: '0 0 7px', fontSize: '10px', color: '#777', textTransform: 'uppercase', fontWeight: '900', letterSpacing: '0.7px' }}>
          {title}
        </p>
        <p style={{ margin: 0, fontSize: '26px', color, fontWeight: '900', lineHeight: 1.05 }}>
          {value}
        </p>
      </div>
      <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
        {icon}
      </div>
    </div>
    {detail && <p style={{ margin: '9px 0 0', fontSize: '11px', color: '#999', lineHeight: 1.35 }}>{detail}</p>}
  </div>
);

const ModalShell = ({ children, width = '420px', zIndex = 1000 }) => (
  <div style={{
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(26,18,8,0.52)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex,
    padding: '20px',
  }}>
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '16px',
      padding: '28px',
      width,
      maxWidth: '100%',
      maxHeight: '90vh',
      overflowY: 'auto',
      boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
      fontFamily: 'Segoe UI, sans-serif',
    }}>
      {children}
    </div>
  </div>
);

// Kept private while existing database records are migrated; it is no longer reachable from Inventory.
// eslint-disable-next-line no-unused-vars
const ItemModal = ({ item, onConfirm, onClose }) => {
  const [formData, setFormData] = useState(item || {
    name: '',
    unit: 'g',
    stock: 0,
    lowStockAt: 500,
    category: 'General',
    expirationDate: '',
    expirationBatches: [{ quantity: 0, expirationDate: '', note: 'Opening stock' }],
  });
  const [batchRows, setBatchRows] = useState(() => normalizeBatchRows(item || formData));
  const [error, setError] = useState('');
  const categoryOptions = Array.from(new Set([...inventoryCategoryOptions, formData.category].filter(Boolean)));
  const batchTotal = getBatchTotal(batchRows);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'stock' || name === 'lowStockAt' ? parseFloat(value) || 0 : value,
    }));
    setError('');
  };

  const updateBatch = (index, field, value) => {
    setBatchRows(prev => prev.map((batch, batchIndex) => (
      batchIndex === index
        ? { ...batch, [field]: field === 'quantity' ? Number(value) || 0 : value }
        : batch
    )));
    setError('');
  };

  const addBatch = () => {
    setBatchRows(prev => [...prev, { quantity: 0, expirationDate: '', note: 'Additional batch' }]);
  };

  const removeBatch = (index) => {
    setBatchRows(prev => prev.length === 1 ? prev : prev.filter((_, batchIndex) => batchIndex !== index));
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      setError('Item name is required');
      return;
    }
    if (!formData.unit.trim()) {
      setError('Unit is required');
      return;
    }
    if (!formData.category.trim()) {
      setError('Category is required');
      return;
    }
    if (!item && Number(formData.stock) < 0) {
      setError('Opening stock cannot be negative');
      return;
    }
    const normalizedBatches = batchRows
      .map(batch => ({
        quantity: Number(batch.quantity) || 0,
        expirationDate: batch.expirationDate || null,
        note: batch.note || '',
      }))
      .filter(batch => batch.quantity > 0);

    if (normalizedBatches.length === 0 && Number(formData.stock || 0) > 0) {
      setError('Please add at least one batch for the current stock.');
      return;
    }

    onConfirm({
      ...formData,
      stock: item ? formData.stock : batchTotal,
      expirationDate: normalizedBatches[0]?.expirationDate || null,
      expirationBatches: normalizedBatches,
    });
  };

  return (
    <ModalShell width="460px">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '22px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '900', margin: 0, color: '#1a1a1a' }}>
            {item ? 'Rename / Edit Inventory Item' : 'Add Inventory Item'}
          </h2>
          <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#8A7A6B' }}>
            {item
              ? 'Rename the item or update category, alert threshold, and expiration date. Stock is changed through Stock In or sales deductions.'
              : 'Register a new ingredient and its opening stock quantity.'}
          </p>
        </div>
        <button onClick={onClose} title="Close" style={{ width: '32px', height: '32px', border: '1px solid #E0D5CB', borderRadius: '8px', backgroundColor: '#fff', color: '#8A7A6B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FiX size={16} />
        </button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Item Name</label>
        <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Chicken Breast" style={inputStyle} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div>
          <label style={labelStyle}>Unit</label>
          <select name="unit" value={formData.unit} onChange={handleChange} style={inputStyle}>
            {inventoryUnitOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>{item ? 'Current Stock (Read Only)' : 'Opening Stock'}</label>
          <input
            type="number"
            name="stock"
          value={item ? batchTotal : batchTotal}
          onChange={handleChange}
          disabled
            style={{
              ...inputStyle,
              backgroundColor: item ? '#F7F3EF' : '#fff',
              color: '#8A7A6B',
              cursor: 'not-allowed',
            }}
          />
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Expiration Batches</label>
          <button type="button" onClick={addBatch} style={{ padding: '7px 10px', border: '1px solid #D4B89A', borderRadius: '7px', backgroundColor: '#fff', color: '#6F4A2F', fontSize: '11px', fontWeight: '900', cursor: 'pointer' }}>
            Add Batch
          </button>
        </div>
        <div style={{ display: 'grid', gap: '8px' }}>
          {batchRows.map((batch, index) => (
            <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 32px', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                min="0"
                value={batch.quantity}
                onChange={event => updateBatch(index, 'quantity', event.target.value)}
                placeholder="Quantity"
                style={inputStyle}
              />
              <input
                type="date"
                value={batch.expirationDate}
                onChange={event => updateBatch(index, 'expirationDate', event.target.value)}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => removeBatch(index)}
                disabled={batchRows.length === 1}
                title="Remove batch"
                style={{ height: '41px', border: '1px solid #FED7D7', borderRadius: '7px', backgroundColor: batchRows.length === 1 ? '#F7F3EF' : '#FFF5F5', color: batchRows.length === 1 ? '#bbb' : '#C53030', cursor: batchRows.length === 1 ? 'not-allowed' : 'pointer', fontWeight: '900' }}
              >
                x
              </button>
            </div>
          ))}
        </div>
        <p style={{ margin: '7px 0 0', fontSize: '11px', color: '#999', lineHeight: 1.4 }}>
          Total batch quantity: {batchTotal.toLocaleString()} {formData.unit}. Items expiring within {NEAR_EXPIRY_DAYS} days appear yellow; expired batches appear red.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div>
          <label style={labelStyle}>Low Stock At</label>
          <input type="number" name="lowStockAt" value={formData.lowStockAt} onChange={handleChange} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Category</label>
          <CompactChoiceSelect name="category" value={formData.category} options={categoryOptions} onChange={handleChange} />
        </div>
      </div>

      {error && (
        <div style={{ color: '#C53030', fontSize: '13px', marginBottom: '16px', padding: '11px 12px', backgroundColor: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: '8px', fontWeight: '700' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px' }}>
        <button onClick={onClose} style={{ ...secondaryButtonStyle, flex: 1 }}>Cancel</button>
        <button onClick={handleSubmit} style={{ ...primaryButtonStyle, flex: 1 }}>{item ? 'Save Changes' : 'Add Item'}</button>
      </div>
    </ModalShell>
  );
};

// eslint-disable-next-line no-unused-vars
const StockInModal = ({ item, onConfirm, onClose }) => {
  const [adjustment, setAdjustment] = useState('');
  const [reason, setReason] = useState('');
  const [expirationDate, setExpirationDate] = useState(formatDateInput(item.expirationDate));
  const [error, setError] = useState('');
  const adjustmentValue = parseFloat(adjustment) || 0;

  const handleConfirm = () => {
    if (adjustmentValue <= 0) {
      setError('Stock-in quantity must be greater than 0');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a stock-in reason');
      return;
    }
    onConfirm({ quantity: adjustmentValue, adjustment: adjustmentValue, reason, expirationDate: expirationDate || null });
  };

  return (
    <ModalShell width="400px" zIndex={1001}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '900', margin: 0, color: '#1a1a1a' }}>Stock In</h2>
          <p style={{ fontSize: '12px', color: '#8A7A6B', margin: '5px 0 0' }}>
            Add newly received supplies for {item.name}. Sales transactions deduct stock automatically.
          </p>
        </div>
        <button onClick={onClose} title="Close" style={{ width: '32px', height: '32px', border: '1px solid #E0D5CB', borderRadius: '8px', backgroundColor: '#fff', color: '#8A7A6B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FiX size={16} />
        </button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Quantity Received</label>
        <input type="number" value={adjustment} onChange={e => { setAdjustment(e.target.value); setError(''); }} placeholder={`Enter received ${item.unit}`} min="0" style={inputStyle} />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Stock-In Reason</label>
        <select value={reason} onChange={e => { setReason(e.target.value); setError(''); }} style={inputStyle}>
          <option value="">Select a reason...</option>
          <option value="New supplies received">New Supplies Received</option>
          <option value="Supplier delivery">Supplier Delivery</option>
          <option value="Restock">Restock</option>
        </select>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Expiration Date</label>
        <input
          type="date"
          value={expirationDate}
          onChange={e => setExpirationDate(e.target.value)}
          style={inputStyle}
        />
        <p style={{ margin: '7px 0 0', fontSize: '11px', color: '#999', lineHeight: 1.4 }}>
          This stock-in will be saved as a separate batch with its own expiration date.
        </p>
      </div>

      {error && (
        <div style={{ color: '#C53030', fontSize: '13px', marginBottom: '16px', padding: '11px 12px', backgroundColor: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: '8px', fontWeight: '700' }}>
          {error}
        </div>
      )}

      {adjustmentValue > 0 && (
        <div style={{ backgroundColor: '#F0FFF4', border: '1px solid #C6F6D5', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '13px', fontWeight: '800', color: '#276749' }}>
          New stock: {item.stock + adjustmentValue} {item.unit}
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px' }}>
        <button onClick={onClose} style={{ ...secondaryButtonStyle, flex: 1 }}>Cancel</button>
        <button onClick={handleConfirm} style={{ ...primaryButtonStyle, flex: 1 }}>Add Stock</button>
      </div>
    </ModalShell>
  );
};

const StockOutModal = ({ item, onConfirm, onClose }) => {
  const [adjustment, setAdjustment] = useState('');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [error, setError] = useState('');
  const adjustmentValue = parseFloat(adjustment) || 0;
  const finalReason = reason === 'Other' ? customReason.trim() : reason;

  const handleConfirm = () => {
    if (adjustmentValue <= 0) {
      setError('Stock-out quantity must be greater than 0');
      return;
    }
    if (adjustmentValue > Number(item.stock || 0)) {
      setError(`Cannot deduct more than current stock (${item.stock} ${item.unit})`);
      return;
    }
    if (!finalReason) {
      setError('Please provide a stock-out reason');
      return;
    }
    onConfirm({ quantity: adjustmentValue, adjustment: adjustmentValue, reason: finalReason });
  };

  return (
    <ModalShell width="400px" zIndex={1001}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '900', margin: 0, color: '#1a1a1a' }}>Stock Out</h2>
          <p style={{ fontSize: '12px', color: '#8A7A6B', margin: '5px 0 0' }}>
            Deduct damaged, lost, or counted-down stock for {item.name}. Expired batches are deducted automatically.
          </p>
        </div>
        <button onClick={onClose} title="Close" style={{ width: '32px', height: '32px', border: '1px solid #E0D5CB', borderRadius: '8px', backgroundColor: '#fff', color: '#8A7A6B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FiX size={16} />
        </button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Quantity To Deduct</label>
        <input type="number" value={adjustment} onChange={e => { setAdjustment(e.target.value); setError(''); }} placeholder={`Max ${item.stock} ${item.unit}`} min="0" max={item.stock} style={inputStyle} />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Stock-Out Reason</label>
        <select value={reason} onChange={e => { setReason(e.target.value); setError(''); }} style={inputStyle}>
          <option value="">Select a reason...</option>
          <option value="Damaged stock">Damaged Stock</option>
          <option value="Theft or loss">Theft or Loss</option>
          <option value="Inventory count correction">Inventory Count Correction</option>
          <option value="Other">Other</option>
        </select>
      </div>

      {reason === 'Other' && (
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Custom Reason</label>
          <input type="text" value={customReason} onChange={e => { setCustomReason(e.target.value); setError(''); }} placeholder="Enter reason" style={inputStyle} />
        </div>
      )}

      {error && (
        <div style={{ color: '#C53030', fontSize: '13px', marginBottom: '16px', padding: '11px 12px', backgroundColor: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: '8px', fontWeight: '700' }}>
          {error}
        </div>
      )}

      {adjustmentValue > 0 && adjustmentValue <= Number(item.stock || 0) && (
        <div style={{ backgroundColor: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '13px', fontWeight: '800', color: '#9B2C2C' }}>
          New stock: {item.stock - adjustmentValue} {item.unit}
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px' }}>
        <button onClick={onClose} style={{ ...secondaryButtonStyle, flex: 1 }}>Cancel</button>
        <button onClick={handleConfirm} style={{ ...primaryButtonStyle, flex: 1, backgroundColor: '#C53030' }}>Deduct Stock</button>
      </div>
    </ModalShell>
  );
};

const buildStats = (inventoryItems) => ({
  totalItems: inventoryItems.length,
  lowStockCount: inventoryItems.filter(item => item.stock > 0 && item.stock <= item.lowStockAt).length,
  outOfStockCount: inventoryItems.filter(item => item.stock === 0).length,
  nearExpiryCount: inventoryItems.filter(item => getExpirationStatus(item).severity === 'near').length,
  expiredCount: inventoryItems.filter(item => getExpirationStatus(item).severity === 'expired').length,
  totalInventoryValue: inventoryItems.reduce((sum, item) => sum + (Number(item.stock) || 0), 0),
});

const getAuditActor = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return {
      actor: user.name || user.email || 'System',
      actorEmail: user.email || '',
    };
  } catch {
    return { actor: 'System', actorEmail: '' };
  }
};

const InventoryNoticeStack = ({ notices, onClose }) => (
  notices.length > 0 && (
    <div
      style={{
        position: 'fixed',
        top: '22px',
        right: '22px',
        width: '360px',
        maxWidth: 'calc(100vw - 44px)',
        zIndex: 3000,
        display: 'grid',
        gap: '10px',
      }}
    >
      {notices.map(notice => (
        <div
          key={notice.id}
          style={{
            backgroundColor: '#FFF5F5',
            border: '1.5px solid #FEB2B2',
            borderLeft: '5px solid #C53030',
            borderRadius: '8px',
            boxShadow: '0 18px 42px rgba(26,18,8,0.18)',
            padding: '14px 16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: 0, color: '#9B2C2C', fontSize: '14px', fontWeight: '900' }}>{notice.title}</p>
              <p style={{ margin: '5px 0 0', color: '#5C2A2A', fontSize: '12px', lineHeight: 1.45 }}>{notice.message}</p>
            </div>
            <button
              onClick={() => onClose(notice.id)}
              title="Close notification"
              style={{
                width: '24px',
                height: '24px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: 'rgba(197,48,48,0.08)',
                color: '#9B2C2C',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '800',
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              x
            </button>
          </div>
          {notice.details?.length > 0 && (
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #FED7D7' }}>
              {notice.details.map(detail => (
                <p key={detail} style={{ margin: '0 0 4px', color: '#742A2A', fontSize: '12px', fontWeight: '700', lineHeight: 1.45 }}>
                  {detail}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
);

const InventoryPage = () => {
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [stats, setStats] = useState({
    totalItems: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    nearExpiryCount: 0,
    expiredCount: 0,
    totalInventoryValue: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const [showStockOutModal, setShowStockOutModal] = useState(false);
  const [adjustItem, setAdjustItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notices, setNotices] = useState([]);

  const addNotice = useCallback((notice) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setNotices(prev => [...prev, { id, ...notice }].slice(-4));
    window.setTimeout(() => {
      setNotices(prev => prev.filter(item => item.id !== id));
    }, 8000);
  }, []);

  const closeNotice = useCallback((id) => {
    setNotices(prev => prev.filter(item => item.id !== id));
  }, []);

  // eslint-disable-next-line no-unused-vars
  const showInventoryError = useCallback((err, fallbackTitle, fallbackMessage, itemName) => {
    const message = String(err.response?.data?.message || fallbackMessage);
    const isDuplicateName = message.toLowerCase().includes('already exists');

    addNotice({
      title: isDuplicateName ? 'Inventory item already exists' : fallbackTitle,
      message: isDuplicateName
        ? `${itemName || 'This item'} is already registered in inventory.`
        : message,
      details: isDuplicateName
        ? ['Use a different item name or edit the existing inventory item instead.']
        : [],
    });
  }, [addNotice]);

  const updateInventoryState = useCallback((inventoryItems, inventoryStats) => {
    setItems(inventoryItems);
    setStats(inventoryStats || buildStats(inventoryItems));

    const uniqueCategories = [...new Set(inventoryItems.map(item => item.category).filter(Boolean))];
    setCategories(uniqueCategories);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [inventoryRes, statsRes] = await Promise.all([
          axios.get('http://localhost:5000/api/inventory'),
          axios.get('http://localhost:5000/api/inventory-stats'),
        ]);

        updateInventoryState(inventoryRes.data, statsRes.data);
      } catch (err) {
        console.error('Error fetching inventory:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [updateInventoryState]);

  useEffect(() => {
    let filtered = items;

    if (searchQuery.trim()) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (categoryFilter) {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }

    if (statusFilter === 'low') {
      filtered = filtered.filter(item => item.stock > 0 && item.stock <= item.lowStockAt);
    } else if (statusFilter === 'out') {
      filtered = filtered.filter(item => item.stock === 0);
    } else if (statusFilter === 'ok') {
      filtered = filtered.filter(item => item.stock > item.lowStockAt);
    } else if (statusFilter === 'near-expiry') {
      filtered = filtered.filter(item => getExpirationStatus(item).severity === 'near');
    } else if (statusFilter === 'expired') {
      filtered = filtered.filter(item => getExpirationStatus(item).severity === 'expired');
    }

    setFilteredItems(filtered);
  }, [items, searchQuery, categoryFilter, statusFilter]);

  const handleStockOut = async (adjustment) => {
    try {
      const response = await axios.put(`http://localhost:5000/api/inventory/${adjustItem._id}/stock-out`, {
        ...adjustment,
        ...getAuditActor(),
      });
      updateInventoryState(items.map(item => item._id === adjustItem._id ? response.data.item : item));
      setShowStockOutModal(false);
      setAdjustItem(null);
    } catch (err) {
      console.error('Error deducting stock:', err);
      alert(err.response?.data?.message || 'Failed to deduct stock');
    }
  };

  const getStockStatus = (item) => {
    if (item.stock === 0) return { label: 'Out of Stock', color: '#C53030', bg: '#FFF5F5', border: '#FED7D7' };
    if (item.stock <= item.lowStockAt) return { label: 'Low Stock', color: '#D97706', bg: '#FFFAF0', border: '#FEEBC8' };
    return { label: 'In Stock', color: '#276749', bg: '#F0FFF4', border: '#C6F6D5' };
  };

  const expiredItems = items.filter(item => getExpirationStatus(item).severity === 'expired');
  const nearExpiryItems = items.filter(item => getExpirationStatus(item).severity === 'near');

  return (
    <div className="mobile-app-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#F5F0EB' }}>
      <InventoryNoticeStack notices={notices} onClose={closeNotice} />
      <Sidebar />

      <main className="mobile-page-content" style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
        <PageHeader
          title="Inventory"
          description="Read current stock, low-stock alerts, and expiry status. Receive supplies through Purchase Orders; record only documented loss, damage, or count corrections here."
        />

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))', gap: '14px', marginBottom: '18px' }}>
          <KPICard title="Total Items" value={stats.totalItems} detail="Inventory ingredients tracked" icon={<FiPackage size={21} />} color="#8B5E3C" />
          <KPICard title="Low Stock" value={stats.lowStockCount} detail="Above zero but below threshold" icon={<FiAlertTriangle size={21} />} color="#D97706" />
          <KPICard title="Out Of Stock" value={stats.outOfStockCount} detail="Ingredients needing restock" icon={<FiX size={21} />} color="#C53030" />
          <KPICard title="Near Expiry" value={stats.nearExpiryCount || 0} detail={`Expiring within ${NEAR_EXPIRY_DAYS} days`} icon={<FiAlertTriangle size={21} />} color="#D97706" />
          <KPICard title="Expired" value={stats.expiredCount || 0} detail="Past expiration date" icon={<FiX size={21} />} color="#C53030" />
          <KPICard title="Total Stock Units" value={stats.totalInventoryValue} detail="Combined on-hand quantity" icon={<FiTrendingUp size={21} />} color="#276749" />
        </section>

        {(expiredItems.length > 0 || nearExpiryItems.length > 0) && (
          <section style={{ display: 'grid', gap: '10px', marginBottom: '18px' }}>
            {expiredItems.length > 0 && (
              <div style={{ backgroundColor: '#FFF5F5', border: '1.5px solid #FED7D7', borderLeft: '5px solid #C53030', borderRadius: '8px', padding: '12px 14px' }}>
                <p style={{ margin: '0 0 5px', color: '#9B2C2C', fontSize: '13px', fontWeight: '900' }}>
                  Expired ingredients need attention
                </p>
                <p style={{ margin: 0, color: '#742A2A', fontSize: '12px', lineHeight: 1.45 }}>
                  {expiredItems.slice(0, 4).map(item => `${item.name} (${formatDisplayDate(item.expirationDate)})`).join(', ')}
                  {expiredItems.length > 4 ? ` and ${expiredItems.length - 4} more` : ''}
                </p>
              </div>
            )}
            {nearExpiryItems.length > 0 && (
              <div style={{ backgroundColor: '#FFFAF0', border: '1.5px solid #FEEBC8', borderLeft: '5px solid #D97706', borderRadius: '8px', padding: '12px 14px' }}>
                <p style={{ margin: '0 0 5px', color: '#975A16', fontSize: '13px', fontWeight: '900' }}>
                  Ingredients near expiration
                </p>
                <p style={{ margin: 0, color: '#744210', fontSize: '12px', lineHeight: 1.45 }}>
                  {nearExpiryItems.slice(0, 4).map(item => `${item.name} (${formatDisplayDate(item.expirationDate)})`).join(', ')}
                  {nearExpiryItems.length > 4 ? ` and ${nearExpiryItems.length - 4} more` : ''}
                </p>
              </div>
            )}
          </section>
        )}

        <section style={{ ...cardStyle, padding: '16px', marginBottom: '18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) repeat(2, minmax(170px, 220px))', gap: '12px', alignItems: 'end' }}>
            <div>
              <label style={labelStyle}>Search</label>
              <div style={{ position: 'relative' }}>
                <FiSearch size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8A7A6B' }} />
                <input type="text" placeholder="Search item name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ ...inputStyle, paddingLeft: '36px' }} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Category</label>
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={inputStyle}>
                <option value="">All Categories</option>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={inputStyle}>
                <option value="">All Status</option>
                <option value="ok">In Stock</option>
                <option value="low">Low Stock</option>
                <option value="out">Out of Stock</option>
                <option value="near-expiry">Near Expiry</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>

          <p style={{ margin: '12px 0 0', fontSize: '12px', color: '#999' }}>
            Showing {filteredItems.length} of {items.length}
          </p>
        </section>

        <section style={{ ...cardStyle, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.1fr 0.9fr 0.7fr 1.35fr 1.1fr 132px', gap: '12px', padding: '14px 18px', backgroundColor: '#1A1208', minWidth: '980px' }}>
            {['Item', 'Category', 'Stock', 'Unit', 'Expiration', 'Status', 'Actions'].map(header => (
              <p key={header} style={{ ...tableHeaderStyle, textAlign: header === 'Actions' ? 'center' : 'left' }}>{header}</p>
            ))}
          </div>

          <div style={{ overflow: 'auto' }}>
            {loading ? (
              <div style={{ padding: '42px', textAlign: 'center', color: '#aaa', fontSize: '14px' }}>Loading inventory...</div>
            ) : filteredItems.length === 0 ? (
              <div style={{ padding: '42px', textAlign: 'center', color: '#aaa', fontSize: '14px' }}>No inventory items found.</div>
            ) : (
              <div style={{ minWidth: '980px' }}>
                {filteredItems.map((item, index) => {
                  const status = getStockStatus(item);
                  const expirationStatus = getExpirationStatus(item);
                  const rowTint = expirationStatus.severity === 'expired'
                    ? '#FFF5F5'
                    : expirationStatus.severity === 'near'
                    ? '#FFFAF0'
                    : index % 2 === 0 ? '#fff' : '#FAFAF8';
                  return (
                    <div
                      key={item._id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1.1fr 0.9fr 0.7fr 1.35fr 1.1fr 132px',
                        gap: '12px',
                        padding: '14px 18px',
                        alignItems: 'center',
                        backgroundColor: rowTint,
                        borderBottom: index === filteredItems.length - 1 ? 'none' : '1px solid #F0E8E0',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '13px', color: '#1a1a1a', fontWeight: '900', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p>
                        <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#8B5E3C', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                          Alert at {item.lowStockAt} {item.unit}
                        </p>
                      </div>
                      <p style={{ margin: 0, fontSize: '13px', color: '#555', fontWeight: '700' }}>{item.category || 'General'}</p>
                      <p style={{ margin: 0, fontSize: '13px', color: '#1a1a1a', fontWeight: '900' }}>{item.stock?.toLocaleString?.() || item.stock}</p>
                      <p style={{ margin: 0, fontSize: '13px', color: '#777', fontWeight: '700' }}>{item.unit}</p>
                      <div>
                        <p style={{ margin: 0, fontSize: '12px', color: '#1a1a1a', fontWeight: '800' }}>{formatDisplayDate(item.expirationDate)}</p>
                        {Array.isArray(item.expirationBatches) && item.expirationBatches.length > 0 && (
                          <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#8A7A6B', fontWeight: '700' }}>
                            {item.expirationBatches.length} batch{item.expirationBatches.length === 1 ? '' : 'es'}
                          </p>
                        )}
                        <span style={{ display: 'inline-flex', width: 'fit-content', marginTop: '5px', alignItems: 'center', padding: '4px 8px', borderRadius: '999px', backgroundColor: expirationStatus.bg, color: expirationStatus.color, border: `1px solid ${expirationStatus.border}`, fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                          {expirationStatus.label}
                        </span>
                      </div>
                      <span style={{ display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '5px 9px', borderRadius: '999px', backgroundColor: status.bg, color: status.color, border: `1px solid ${status.border}`, fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap' }}>
                        {status.label}
                      </span>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button onClick={() => { setAdjustItem(item); setShowStockOutModal(true); }} title="Stock Out" style={{ width: '32px', height: '32px', borderRadius: '7px', backgroundColor: '#FFF5F5', color: '#C53030', border: '1px solid #FED7D7', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FiMinus size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      {showStockOutModal && adjustItem && (
        <StockOutModal
          item={adjustItem}
          onConfirm={handleStockOut}
          onClose={() => { setShowStockOutModal(false); setAdjustItem(null); }}
        />
      )}
    </div>
  );
};

export default InventoryPage;
