import React, { useEffect, useState } from 'react';
import axios from 'axios';

const quantity = value => new Intl.NumberFormat('en-PH', { maximumFractionDigits: 3 }).format(value);
const dateLabel = date => new Date(`${date}T00:00:00+08:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });

export default function IngredientDemandForecast({ source, refresh }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setResult(null);
    setLoading(true);
    setError('');
    axios.get(`http://localhost:5000/api/sales-forecast/ingredient-demand?source=${source}`, { signal: controller.signal })
      .then(response => { if (active) setResult(response.data); })
      .catch(err => { if (active) setError(err.response?.data?.message || 'Ingredient estimates could not be loaded. Please try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [source, refresh, retry]);
  const current = result?.source === source ? result : null;
  const ready = !loading && current?.status === 'ready';
  const demo = source === 'demo';
  return <section className="forecast-ingredients" aria-labelledby="ingredient-demand-heading" aria-busy={loading}>
    <h3 id="ingredient-demand-heading">Ingredient Demand{demo ? ' (sample)' : ''}</h3>
    <div aria-live="polite">
      {loading && <p>Estimating ingredient needs...</p>}
      {error && <div role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Retry ingredient estimates</button></div>}
      {!loading && !error && current && !ready && <>
        <p className="ingredient-empty-title">{current.status === 'needs-review' ? 'Review sales and recipe mappings' : 'More product sales data needed'}</p>
        <p>{current.message || (current.status === 'needs-review'
          ? 'An estimate would be incomplete. Resolve these records before planning ingredient purchases.'
          : 'No recently sold products have enough usable history and recipe mappings for an ingredient estimate.')}</p>
        {current.issues?.length > 0 && <ul className="ingredient-issues">{current.issues.map(issue => <li key={`${issue.name}:${issue.message}`}><strong>{issue.name}:</strong> {issue.message}</li>)}</ul>}
      </>}
    </div>
    {ready && <>
      <p className="ingredient-period">{dateLabel(current.from)} – {dateLabel(current.through)} · Including today</p>
      <div className="data-scroll-box ingredient-demand-scroll" tabIndex={0} role="region" aria-label="Seven-day ingredient demand estimates">
        <table><thead><tr><th>Ingredient</th><th>Estimated need</th><th>Usable stock</th><th>Additional needed</th><th>Outlook</th></tr></thead>
          <tbody>{current.ingredients.map(item => <tr key={item.inventoryId}>
            <th scope="row">{item.name}</th><td>{quantity(item.estimatedDemand)} {item.unit}</td>
            <td>{quantity(item.availableStock)} {item.unit}</td><td>{quantity(item.shortfall)} {item.unit}</td>
            <td><span className={`ingredient-outlook ${item.shortfall > 0 ? 'ingredient-shortage' : ''}`}>{item.shortfall > 0 ? 'Restock' : 'Covered'}</span>
              {item.expiringUnused > 0 && <small>Some stock expires before use</small>}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </>}
  </section>;
}
