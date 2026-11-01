import React, { useId, useState } from 'react';

export default function InventoryItemSelect({ items, value, onChange, id, inputStyle }) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const selected = items.find(item => item._id === value);
  const search = query.trim().toLowerCase();
  const matches = items.filter(item => `${item.name} ${item.category || ''} ${item.unit}`.toLowerCase().includes(search));
  const newItem = { _id: '__new__', name: 'New inventory item...' };
  const options = search ? [...matches, newItem] : [newItem, ...matches];
  const display = item => item._id === '__new__' ? item.name : `${item.name} (${item.unit})`;
  const choose = item => { onChange(item._id); setOpen(false); setQuery(''); };

  return <div style={{ position: 'relative' }} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <input id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId}
      aria-activedescendant={open ? `${listId}-${active}` : undefined}
      autoComplete="off" placeholder="Search inventory..."
      value={open ? query : selected ? display(selected) : 'New inventory item...'}
      onFocus={() => { setQuery(''); setActive(0); setOpen(true); }}
      onClick={() => { if (!open) { setQuery(''); setActive(0); setOpen(true); } }}
      onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true); }}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          setOpen(true);
          const next = open ? Math.max(0, Math.min(options.length - 1, active + (event.key === 'ArrowDown' ? 1 : -1))) : 0;
          setActive(next);
          document.getElementById(`${listId}-${next}`)?.scrollIntoView?.({ block: 'nearest' });
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          if (open) choose(options[active]);
          else { setQuery(''); setActive(0); setOpen(true); }
        }
      }} style={inputStyle} />
    {open && <div id={listId} role="listbox" aria-label="Inventory items" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: '4px', maxHeight: '220px', overflowY: 'auto', background: '#fff', border: '1px solid #D8CABB', borderRadius: '8px' }}>
      {matches.length === 0 && <p role="status" style={{ margin: 0, padding: '10px', fontSize: '12px', color: '#777' }}>No matching inventory items.</p>}
      {options.map((item, index) => <button type="button" role="option" id={`${listId}-${index}`} key={item._id}
        aria-selected={active === index} tabIndex={-1}
        onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(item)}
        style={{ display: 'block', width: '100%', padding: '10px 11px', border: 0, textAlign: 'left', fontFamily: 'inherit', fontSize: '13px', cursor: 'pointer', color: '#3D1F0D', background: active === index ? '#F5F0EB' : '#fff' }}>
        {display(item)}
      </button>)}
    </div>}
  </div>;
}
