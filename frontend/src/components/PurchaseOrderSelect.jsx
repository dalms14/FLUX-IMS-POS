import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FiCheck, FiChevronDown } from 'react-icons/fi';
import './PurchaseOrderSelect.css';

export default function PurchaseOrderSelect({ id, label, options, value, onChange, placeholder = 'Select an option', required = false }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [placement, setPlacement] = useState({ above: false, height: 220 });
  const rootRef = useRef(null);
  const typeahead = useRef({ text: '', time: 0 });
  const selectedIndex = options.findIndex(option => option.value === value);
  const selected = options[selectedIndex];
  const listId = `${id}-options`;
  const show = () => { setActive(Math.max(0, selectedIndex)); setOpen(true); };
  const choose = option => {
    if (!option) return;
    onChange(option.value);
    setOpen(false);
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    // Keep the menu inside the scrolling modal, including fields near its foot.
    const position = () => {
      const rect = rootRef.current.getBoundingClientRect();
      const modal = rootRef.current.closest('.purchase-order-modal')?.getBoundingClientRect();
      const below = Math.min(window.innerHeight, modal?.bottom ?? window.innerHeight) - rect.bottom - 12;
      const above = rect.top - Math.max(0, modal?.top ?? 0) - 12;
      const useAbove = below < 220 && above > below;
      setPlacement({ above: useAbove, height: Math.max(0, Math.min(220, useAbove ? above : below)) });
    };
    position();
    window.addEventListener('resize', position);
    document.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      document.removeEventListener('scroll', position, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active, listId]);

  useEffect(() => {
    const outside = event => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);

  return <div ref={rootRef} className={`purchase-order-select${open ? ' is-open' : ''}`} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button id={id} type="button" role="combobox" className="purchase-order-select-trigger"
      aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-required={required}
      aria-controls={open ? listId : undefined}
      aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
      data-required-missing={required && !value ? 'true' : undefined}
      data-validation-message="Select a receiving staff member or admin, or choose Any Staff or Everyone."
      onClick={() => open ? setOpen(false) : show()}
      onKeyDown={event => {
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          setOpen(true);
          setActive(current => event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
            : !open ? Math.max(0, selectedIndex) : Math.max(0, Math.min(options.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1))));
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (open) choose(options[active]);
          else show();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        } else if (event.key === 'Tab') setOpen(false);
        else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const now = Date.now();
          const text = (now - typeahead.current.time < 700 ? typeahead.current.text : '') + event.key.toLowerCase();
          typeahead.current = { text, time: now };
          const match = options.findIndex(option => option.label.toLowerCase().startsWith(text));
          if (match >= 0) { event.preventDefault(); setActive(match); setOpen(true); }
        }
      }}>
      <span className={selected ? '' : 'purchase-order-select-placeholder'}>{selected?.label || placeholder}</span>
      <FiChevronDown aria-hidden="true" />
    </button>
    {open && <div id={listId} role="listbox" aria-label={label} className={`purchase-order-select-menu${placement.above ? ' opens-above' : ''}`} style={{ maxHeight: placement.height }}>
      {options.length === 0 && <p className="purchase-order-select-empty">No available options.</p>}
      {options.map((option, index) => <button key={option.value} id={`${listId}-${index}`} type="button" role="option" tabIndex={-1}
        aria-selected={option.value === value}
        className={`purchase-order-select-option${index === active ? ' is-active' : ''}${option.value === value ? ' is-selected' : ''}`}
        onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(option)}>
        <span>{option.label}</span>{option.value === value && <FiCheck aria-hidden="true" />}
      </button>)}
    </div>}
  </div>;
}
