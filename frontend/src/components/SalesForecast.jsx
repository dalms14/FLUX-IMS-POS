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
      <strong>{demo ? 'SAMPLE DATA' : 'REAL SALES'}</strong>
      <span>{demo ? 'These estimates use sample data, not Eli Coffee sales. Your test transactions are not used.' : 'Uses completed client sales from the verified start date. Pre-handover test transactions are excluded.'}</span>
    </div>
    <div aria-live="polite">
      {loading && <p className="forecast-empty">Preparing the sales outlook...</p>}
      {error && <div className="forecast-empty" role="alert"><p>{error}</p><button type="button" onClick={() => setRefresh(value => value + 1)}>Try again</button></div>}
      {!loading && !error && current && !ready && <div className="forecast-empty">
        <h3>{current.status === 'insufficient-history' ? 'More sales history needed' : 'Real sales are not ready for forecasting'}</h3>
        <p>{current.status === 'insufficient-history' ? `${current.historyDays} of ${current.minimumHistoryDays} completed days available. Four weeks of sales are needed for this estimate.` : current.message}</p>
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
      <p className="forecast-explanation"><strong>How it works:</strong> Each day's estimate is the average sales from the same weekday over the past four weeks. For example, Monday uses the last four Mondays.</p>
      <p className="forecast-footnote">Estimates may differ from actual sales. Amounts are after discounts, before refunds. History through {dateLabel(current.trainedThrough)} (Philippine time); date filters above do not change the forecast.</p>
    </>}
  </section>;
}
