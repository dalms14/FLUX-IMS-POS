import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FiRefreshCw } from 'react-icons/fi';
import './SalesForecast.css';

const money = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value);
const dateLabel = date => new Date(`${date}T00:00:00+08:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
const dayLabel = date => new Date(`${date}T00:00:00+08:00`).toLocaleDateString('en-PH', { weekday: 'short', timeZone: 'Asia/Manila' });

export default function SalesForecast() {
  const [source, setSource] = useState('demo');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setData(null);
    axios.get(`http://localhost:5000/api/sales-forecast?source=${source}`, { signal: controller.signal })
      .then(response => { if (active) setData(response.data); })
      .catch(err => { if (active) setError(err.response?.data?.message || 'The sales forecast could not be loaded. Please try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [source, refresh]);
  // Never show the previous source's figures while a different source loads.
  const current = data?.source === source ? data : null;
  const ready = !loading && current?.status === 'ready';
  const demo = source === 'demo';
  const highest = ready ? Math.max(1, ...current.forecast.map(row => row.sales)) : 1;
  return <section className="sales-forecast" aria-labelledby="sales-forecast-heading" aria-busy={loading}>
    <div className="forecast-header">
      <div className="forecast-heading"><div><h2 id="sales-forecast-heading">Sales Forecast</h2>
        <p className="forecast-subtitle">Estimated sales for the coming week.</p>
      </div></div>
      <div className="forecast-controls">
        <div className="forecast-source" role="group" aria-label="Forecast data source">
          <button type="button" aria-pressed={demo} onClick={() => setSource('demo')}>Demo data</button>
          <button type="button" aria-pressed={!demo} onClick={() => setSource('real')}>Real sales</button>
        </div>
        <button className="forecast-refresh" type="button" aria-label="Reload sales forecast" disabled={loading} onClick={() => setRefresh(value => value + 1)}><FiRefreshCw /></button>
      </div>
    </div>
    <div className={`forecast-notice ${demo ? 'forecast-demo' : ''}`}>
      <strong>{demo ? 'ML DEMONSTRATION' : 'REAL SALES'}</strong>
      <span>{demo ? 'Machine-learning demonstration using sample data, not Eli Coffee sales. Your test transactions are not used. Performance on real client sales has not been established.' : 'Uses completed client sales from the verified start date. Pre-handover test transactions are excluded.'}</span>
    </div>
    <div aria-live="polite">
      {loading && <p className="forecast-empty">Preparing the sales outlook...</p>}
      {error && <div className="forecast-empty" role="alert"><p>{error}</p><button type="button" onClick={() => setRefresh(value => value + 1)}>Try again</button></div>}
      {!loading && !error && current && !ready && <div className="forecast-empty">
        <h3>{current.status === 'insufficient-history' ? 'More sales history needed' : 'Real sales are not ready for forecasting'}</h3>
        <p>{current.status === 'insufficient-history' ? `${current.historyDays} of ${current.minimumHistoryDays} completed days available. More daily sales are needed to train and test the model.` : current.message}</p>
        <span>You can explore the feature with Demo data while preparing for client handover.</span>
      </div>}
    </div>
    {ready && <>
      <div className="forecast-metrics">
        <div><span>Tomorrow{demo ? ' (sample)' : ''}</span><strong>{money(current.tomorrow)}</strong><small>{dateLabel(current.forecast[1].date)}</small></div>
        <div><span>Coming 7 days{demo ? ' (sample)' : ''}</span><strong>{money(current.total)}</strong><small>Including today</small></div>
      </div>
      <div className="forecast-days" role="list" aria-label="Daily sales estimates">
        {current.forecast.map(row => <div className="forecast-day" role="listitem" key={row.date}>
          <span className="forecast-date">{dayLabel(row.date)}<small>{dateLabel(row.date)}</small></span>
          <div className="forecast-bar" aria-hidden="true"><span style={{ width: `${row.sales / highest * 100}%` }} /></div>
          <strong>{money(row.sales)}{row.closed && <small>Closed</small>}</strong>
        </div>)}
      </div>
      {current.tracking && <div className="forecast-tracking">
        <h3>Forecast vs. Actual{demo ? ' (sample)' : ''}</h3>
        <p>Compare saved estimates with sales after each day ends.</p>
        {demo && <p>Sample data only — not Eli Coffee sales.</p>}
        {current.tracking.unavailable ? <p role="alert">Forecast tracking is unavailable. Predictions could not be saved or compared. Reload to retry.</p> : <>
          {current.tracking.comparedDays > 0
            ? <p><strong>Average difference: {money(current.tracking.mae)} per day</strong> · {current.tracking.comparedDays} days checked. Lower is better.</p>
            : <p>Results will appear after a saved forecast day ends.</p>}
          <div className="data-scroll-box forecast-comparison-scroll" tabIndex={0} role="region" aria-label="Saved forecast comparisons">
            <table><thead><tr><th>Date</th><th>Estimate</th><th>{demo ? 'Sample sales' : 'Actual sales'}</th><th>Difference</th><th>Status</th></tr></thead>
              <tbody>{current.tracking.rows.map(row => <tr key={row.date}>
                <td>{row.date}</td><td>{money(row.predicted)}</td><td>{row.actual === null ? '—' : money(row.actual)}</td>
                <td>{row.error === null ? '—' : money(row.error)}</td><td>{row.status === 'compared' ? 'Checked' : row.status === 'missing-sales' ? 'Missing sales' : 'Waiting'}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <details><summary>Details</summary>
            <p>Opening this page saves the first estimate for tomorrow onward. Refreshing keeps it unchanged. Comparisons cover the last 30 completed days.</p>
            <p>Difference means how far the estimate was above or below sales. The average uses completed comparisons only.</p>
            <p>Sales are after discounts, before refunds. Missing records are not counted as zero unless the day is confirmed closed.</p>
            {demo && <p>Sample comparisons do not measure accuracy for Eli Coffee.</p>}
          </details>
        </>}
      </div>}
      <details className="forecast-model-check"><summary>How the forecast works</summary>
        <p>A linear regression model learns weekday patterns and the sales trend from past daily sales, then estimates the coming week.</p>
        <p>History through {dateLabel(current.trainedThrough)} (Philippine time). Date filters above do not change the forecast.</p>
      {current.validation && <>
        <p>Trained on {current.historyDays} completed days. Tested on {current.validation.days} later days in two weekly checks, using only earlier sales for each prediction.</p>
        <p>Average test error{demo ? ' on sample data' : ''}: <strong>{money(current.validation.modelMae)} per day</strong>. Four-week average comparison: <strong>{money(current.validation.baselineMae)} per day</strong>. Lower error is better.</p>
        {current.validation.baselineIsBetter && <p>The four-week average had lower error in this check. The machine-learning model is not guaranteed to perform better.</p>}
        {demo && <p>These results demonstrate the training and testing process; they do not establish accuracy for Eli Coffee.</p>}
      </>}
      </details>
      <p className="forecast-footnote">Estimates are a guide and may differ from actual sales.</p>
    </>}
  </section>;
}
