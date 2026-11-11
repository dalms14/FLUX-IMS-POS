import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import ValidatedForm from './ValidatedForm';
import { defaultShiftSchedule, SHIFT_DAYS, shiftSummary, isShiftExempt } from '../utils/shiftSchedule';

export default function UserShiftModal({ user, onClose, onSaved }) {
  const [schedule, setSchedule] = useState(() => ({ ...defaultShiftSchedule(), ...user.shiftSchedule, workdays: [...(user.shiftSchedule?.workdays || [])] }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef(null);
  const dayInput = useRef(null);
  const startInput = useRef(null);
  const endInput = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    dayInput.current?.focus();
    return () => previousFocus?.focus();
  }, []);
  const change = (field, value) => { setSchedule(current => ({ ...current, [field]: value })); setError(''); };
  const close = () => { if (!saving) onClose(); };
  const overnight = schedule.startTime && schedule.endTime && schedule.endTime < schedule.startTime;
  const submit = async event => {
    event.preventDefault();
    if (saving) return;
    const configured = schedule.workdays.length || schedule.startTime || schedule.endTime || schedule.restrictLogin;
    if (configured && (!schedule.workdays.length || !schedule.startTime || !schedule.endTime)) {
      setError('Select at least one workday and enter both shift times.');
      (!schedule.workdays.length ? dayInput : !schedule.startTime ? startInput : endInput).current?.focus();
      return;
    }
    if (configured && schedule.startTime === schedule.endTime) {
      setError('Shift start and end times must be different. An earlier end time means the following day.');
      endInput.current?.focus();
      return;
    }
    setSaving(true); setError('');
    try {
      const response = await axios.put(`http://localhost:5000/api/auth/users/${user._id}/shift`, { shiftSchedule: schedule });
      onSaved(response.data.user);
    } catch (err) { setError(err.response?.data?.message || 'Unable to save the shift schedule. Please try again.'); }
    finally { setSaving(false); }
  };
  return <div className="user-shift-overlay" onMouseDown={close}>
    <section ref={dialog} className="user-shift-dialog" role="dialog" aria-modal="true" aria-labelledby="user-shift-title" aria-describedby="user-shift-description" onMouseDown={event => event.stopPropagation()} onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); close(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled)'));
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <ValidatedForm onSubmit={submit}>
        <div className="user-shift-heading"><div><h2 id="user-shift-title">Edit shift</h2><p>{user.name || user.email}</p></div><button type="button" aria-label="Close shift settings" onClick={close} disabled={saving}>Close</button></div>
        <p id="user-shift-description" className="user-shift-notice">{isShiftExempt(user) ? 'Admins can sign in anytime.' : 'Limit sign-in to shift hours, including early access.'}</p>
        <fieldset disabled={saving} className="user-shift-days"><legend>Workdays</legend>
          {SHIFT_DAYS.map(([day, label], index) => <label key={day}><input ref={index === 0 ? dayInput : undefined} type="checkbox" checked={schedule.workdays.includes(day)} onChange={() => change('workdays', schedule.workdays.includes(day) ? schedule.workdays.filter(value => value !== day) : SHIFT_DAYS.map(([value]) => value).filter(value => value === day || schedule.workdays.includes(value)))} />{label}</label>)}
        </fieldset>
        <div className="user-shift-times">
          <label>Shift start<input ref={startInput} type="time" value={schedule.startTime} disabled={saving} onChange={event => change('startTime', event.target.value)} /></label>
          <label>Shift end<input ref={endInput} type="time" value={schedule.endTime} disabled={saving} onChange={event => change('endTime', event.target.value)} /></label>
        </div>
        <p className="user-shift-help">Philippine time. Select the days the shift starts.{overnight ? ' Ends the next day.' : ''}</p>
        <label className="user-shift-toggle"><input type="checkbox" checked={schedule.restrictLogin} disabled={saving || isShiftExempt(user)} onChange={event => change('restrictLogin', event.target.checked)} />Restrict login to shift</label>
        {!isShiftExempt(user) && <p className="user-shift-notice">When enabled, active sessions show a 5-minute countdown at shift end, then sign out automatically. All times use Philippine time.</p>}
        {!isShiftExempt(user) && <p className="user-shift-help">Existing sessions stay active after the shift.</p>}
        <label className="user-shift-allowance">Early login (0–120 minutes)<input type="number" min="0" max="120" step="1" required value={schedule.earlyLoginMinutes} disabled={saving} onChange={event => change('earlyLoginMinutes', event.target.value === '' ? '' : Number(event.target.value))} /></label>
        <div className="user-shift-preview"><strong>Preview</strong><p>{shiftSummary(schedule)}</p></div>
        {error && <p className="user-shift-error" role="alert">{error}</p>}
        <div className="user-shift-actions"><button type="button" disabled={saving} onClick={() => { setSchedule(defaultShiftSchedule()); setError(''); }}>Clear schedule</button><div><button type="button" disabled={saving} onClick={close}>Cancel</button><button className="user-shift-primary" disabled={saving}>{saving ? 'Saving…' : 'Save shift'}</button></div></div>
      </ValidatedForm>
    </section>
  </div>;
}
