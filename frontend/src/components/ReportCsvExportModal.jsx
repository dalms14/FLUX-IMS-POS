import React, { useEffect, useRef, useState } from 'react';
import { FiArchive, FiCalendar, FiDownload, FiEye, FiFileText, FiX } from 'react-icons/fi';
import { REPORT_CSV_OPTIONS } from '../utils/reportCsv';
import { csvPeriod, loadReportCsv, manilaToday } from '../utils/loadReportCsv';
import './ReportCsvExportModal.css';

const prettyDate = value => value ? new Date(`${value}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '';

export default function ReportCsvExportModal({ initialType, initialStart, initialEnd, loginQuery, loginRole, onClose, onDownload }) {
  const [type, setType] = useState(initialType || 'sales_transactions');
  const [mode, setMode] = useState(!initialStart && !initialEnd ? 'all' : initialStart === initialEnd ? 'day' : 'range');
  const [start, setStart] = useState(initialStart || manilaToday());
  const [end, setEnd] = useState(initialEnd || initialStart || manilaToday());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const dialog = useRef(null);
  const alive = useRef(true);
  const request = useRef(null);
  const snapshot = type === 'inventory';
  const category = REPORT_CSV_OPTIONS.find(([key]) => key === type)?.[1];
  const periodLabel = snapshot ? `Current stock · ${prettyDate(manilaToday())}` : mode === 'all' ? 'All available dates'
    : mode === 'day' ? prettyDate(start) || 'Select a date' : `${prettyDate(start) || 'Start date'} – ${prettyDate(end) || 'End date'}`;

  useEffect(() => {
    alive.current = true;
    dialog.current?.querySelector('select')?.focus();
    return () => { alive.current = false; request.current?.abort(); document.getElementById('csv-export-button')?.focus(); };
  }, []);
  const change = callback => { callback(); setResult(null); setError(''); };
  const prepare = async download => {
    if (busy) return;
    try { if (!snapshot) csvPeriod(mode, start, end); }
    catch (err) { setError(err.message); return; }
    setBusy(true);
    setError('');
    request.current = new AbortController();
    try {
      const prepared = result || await loadReportCsv({ type, mode, startDate: start, endDate: end, loginQuery, loginRole, signal: request.current.signal });
      if (!alive.current) return;
      setResult(prepared);
      if (download) onDownload(prepared);
    } catch (err) {
      if (alive.current) setError(err.response?.data?.message || err.message || 'Unable to prepare the report. Please try again.');
    } finally { if (alive.current) setBusy(false); }
  };

  return <div className="csv-export-overlay">
    <section ref={dialog} className="csv-export-dialog" role="dialog" aria-modal="true" aria-labelledby="csv-export-title" aria-describedby="csv-export-description" onKeyDown={event => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const controls = Array.from(event.currentTarget.querySelectorAll('select:not(:disabled), input:not(:disabled), button:not(:disabled)'));
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls[controls.length - 1]?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) { event.preventDefault(); controls[0]?.focus(); }
    }}>
      <header className="csv-export-heading">
        <span className="csv-export-icon"><FiFileText aria-hidden="true" /></span>
        <div><span className="csv-export-eyebrow">FLUX REPORTS</span><h2 id="csv-export-title">Export CSV</h2><p id="csv-export-description">Choose your records and the dates you want to review.</p></div>
        <button className="csv-export-close" onClick={onClose} aria-label="Close CSV export"><FiX aria-hidden="true" /></button>
      </header>
      <div className="csv-export-body">
        <label className="csv-export-label" htmlFor="csv-record-type">Record category</label>
        <select id="csv-record-type" value={type} disabled={busy} onChange={event => change(() => setType(event.target.value))}>
          {REPORT_CSV_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        {snapshot ? <div className="csv-export-snapshot"><FiArchive aria-hidden="true" /><p><strong>Current inventory snapshot</strong><br />This shows stock now. To review stock activity on a past date, select Inventory movements.</p></div> : <fieldset className="csv-period" disabled={busy}>
          <legend>Reporting period</legend>
          <div className="csv-period-options">{[['day', 'Single day'], ['range', 'Date range'], ['all', 'All time']].map(([key, label]) => <button type="button" key={key} aria-pressed={mode === key} onClick={() => change(() => setMode(key))}>{label}</button>)}</div>
          {mode === 'day' && <label className="csv-date-label" htmlFor="csv-report-date">Report date<input id="csv-report-date" type="date" value={start} onChange={event => change(() => setStart(event.target.value))} /></label>}
          {mode === 'range' && <div className="csv-date-grid">
            <label className="csv-date-label" htmlFor="csv-start-date">Start date<input id="csv-start-date" type="date" value={start} onChange={event => change(() => setStart(event.target.value))} /></label>
            <label className="csv-date-label" htmlFor="csv-end-date">End date<input id="csv-end-date" type="date" value={end} min={start || undefined} onChange={event => change(() => setEnd(event.target.value))} /></label>
          </div>}
          {mode === 'all' && <p className="csv-export-hint">Includes records from all available dates.</p>}
        </fieldset>}
        <div className="csv-export-summary"><FiCalendar aria-hidden="true" /><div><strong>{periodLabel}</strong><span>{category} · CSV spreadsheet</span></div></div>
        {type === 'login_activity' && (loginQuery || loginRole !== 'all') && <p className="csv-export-hint">Login filters: {loginQuery || 'All names'} · {loginRole === 'all' ? 'All roles' : loginRole}.</p>}
        {error && <p className="csv-export-error" role="alert">{error}</p>}
        {busy && <p className="csv-export-hint" role="status">Preparing your report…</p>}
        {result && <section className="csv-preview" aria-label="CSV preview">
          <div className="csv-preview-heading"><strong>{result.rowCount.toLocaleString()} row{result.rowCount === 1 ? '' : 's'} ready</strong><span>{result.rowCount > 5 ? 'Previewing the first 5' : 'Report preview'}</span></div>
          {result.rowCount ? <div className="csv-preview-scroll" tabIndex={0} role="region" aria-label="Report preview table"><table><thead><tr>{result.rows[0].map((heading, index) => <th key={index}>{heading}</th>)}</tr></thead><tbody>{result.rows.slice(1, 6).map((row, index) => <tr key={index}>{row.map((value, column) => <td key={column}>{String(value ?? '—')}</td>)}</tr>)}</tbody></table></div> : <p>No matching records. Change the dates or download an empty table with column headers.</p>}
          <p className="csv-export-filename">{result.filename}</p>
        </section>}
        <p className="csv-export-hint csv-timezone">Report dates and times follow Philippine time (UTC+8).</p>
      </div>
      <footer className="csv-export-footer"><button className="csv-export-cancel" onClick={onClose}>Cancel</button><div><button className="csv-export-preview" onClick={() => prepare(false)} disabled={busy}><FiEye aria-hidden="true" /> Preview report</button><button className="csv-export-download" onClick={() => prepare(true)} disabled={busy}><FiDownload aria-hidden="true" />{busy ? 'Preparing…' : 'Download CSV'}</button></div></footer>
    </section>
  </div>;
}
