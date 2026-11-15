import React, { useRef, useState } from 'react';
import PurchaseOrderSelect from './PurchaseOrderSelect';
import { mergeCategoryNames } from '../utils/useInventoryCategories';
import './InventoryCategorySelect.css';

export default function InventoryCategorySelect({ id, label, value, onChange, manager, existingCategories = [], allowAll = false }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const categories = mergeCategoryNames(manager.categories, existingCategories, [value]);
  let newCategoryValue = '__new_category__';
  while (categories.includes(newCategoryValue)) newCategoryValue += '_';
  const focusTrigger = () => document.getElementById(id)?.focus();
  const cancel = () => { setCreating(false); setError(''); setName(''); focusTrigger(); };
  const save = async () => {
    if (busy.current) return;
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!clean || clean.length > 80) { setError('Enter a category name between 1 and 80 characters.'); return; }
    if (categories.some(category => category.toLowerCase() === clean.toLowerCase())) {
      setError('That category already exists. Choose it from the list.'); return;
    }
    busy.current = true;
    setSaving(true); setError('');
    try {
      const saved = await manager.addCategory(clean);
      onChange(saved);
      cancel();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not save the category. Please try again.');
    } finally { busy.current = false; setSaving(false); }
  };
  const options = [
    ...(allowAll ? [{ value: '', label: 'All Categories' }] : []),
    ...categories.map(category => ({ value: category, label: category })),
    { value: newCategoryValue, label: '+ New category' },
  ];

  return <div className="inventory-category-select">
    <PurchaseOrderSelect id={id} label={label} value={value} options={options} onChange={next => {
      if (next === newCategoryValue) { setCreating(true); setError(''); }
      else onChange(next);
    }} />
    {manager.error && <div className="inventory-category-load-error" role="status">{manager.error} <button type="button" onClick={manager.reload} disabled={manager.loading}>Retry</button></div>}
    {creating && <div className="inventory-category-editor" role="group" aria-label="Create inventory category" onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!saving) cancel(); }
    }}>
      <label htmlFor={`${id}-new`}>New category name</label>
      <input id={`${id}-new`} autoFocus autoComplete="off" maxLength={80} value={name} disabled={saving}
        aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
        onChange={event => { setName(event.target.value); setError(''); }}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); save(); } }}
        placeholder="e.g. Cleaning Supplies" />
      {error && <p id={`${id}-error`} role="alert">{error}</p>}
      <div className="inventory-category-actions">
        <button type="button" disabled={saving} onClick={cancel}>Cancel</button>
        <button type="button" disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save category'}</button>
      </div>
    </div>}
  </div>;
}
