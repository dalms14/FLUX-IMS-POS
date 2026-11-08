import ValidatedForm from './ValidatedForm';
import React, { useState } from 'react';
import './PosPriceFilter.css';

export default function PosPriceFilter({ budget, onChange }) {
    const [open, setOpen] = useState(false);
    const [amount, setAmount] = useState('');
    const [error, setError] = useState('');
    const apply = value => { onChange(value); setAmount(value); setError(''); setOpen(false); };
    return <>
        <button type="button" className="pos-price-button" aria-expanded={open} aria-controls="pos-price-options" onClick={() => { setOpen(!open); setAmount(budget); setError(''); }}>
            {budget ? `Below ₱${Number(budget).toLocaleString()}` : 'Price filter'}
        </button>
        {open && <div id="pos-price-options" className="pos-price-options">
            <ValidatedForm onSubmit={event => {
                event.preventDefault();
                if (!/^\d+(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 || Number(amount) > 1000000) { setError('Enter a budget above 0, with up to two decimal places.'); return; }
                apply(amount);
            }}>
                <label htmlFor="pos-price-budget">Customer budget (PHP)</label>
                <div className="pos-price-custom">
                    <input id="pos-price-budget" autoFocus inputMode="decimal" value={amount} placeholder="e.g. 200" onChange={e => { setAmount(e.target.value); setError(''); }} aria-invalid={!!error} aria-describedby={error ? 'pos-price-error' : undefined} />
                    <button type="submit">Apply</button>
                    <button type="button" onClick={() => setOpen(false)}>Close</button>
                </div>
            </ValidatedForm>
            {error && <p id="pos-price-error" role="alert">{error}</p>}
            <p>Shows solo prices below your budget. Variants and add-ons may cost extra.</p>
        </div>}
    </>;
}
