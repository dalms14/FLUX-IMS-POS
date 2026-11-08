import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { FiAlertCircle } from 'react-icons/fi';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import { canManageEliteMembers } from '../utils/roles';
import { getSessionUser } from '../utils/session';
import { isAllowedMemberNameInput, isValidMemberName, MEMBER_NAME_ERROR, isValidMemberEmail, MEMBER_EMAIL_ERROR } from '../utils/memberValidation';
import './EliteMembersPage.css';

const endpoint = 'http://localhost:5000/api/elite-members';
const blank = { name: '', idNumber: '', email: '', status: 'active', notes: '' };
const FieldError = ({ id, message }) => message ? <span id={id} className="elite-field-error" role="alert"><FiAlertCircle aria-hidden="true" /><span>{message}</span></span> : null;

export default function EliteMembersPage() {
  const permitted = canManageEliteMembers(getSessionUser() || {});
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  const [archiveAction, setArchiveAction] = useState(null);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const nameInput = useRef(null);
  const cardInput = useRef(null);
  const emailInput = useRef(null);
  const archiveCancel = useRef(null);

  useEffect(() => { if (archiveAction) archiveCancel.current?.focus(); }, [archiveAction]);

  useEffect(() => {
    if (!permitted) return undefined;
    let alive = true;
    setLoading(true);
    setError('');
    const timer = setTimeout(async () => {
      try {
        const response = await axios.get(`${endpoint}?includeInactive=true&archived=${showArchived}&search=${encodeURIComponent(search.trim())}`);
        if (alive) setMembers(response.data.data || []);
      } catch (err) {
        if (alive) { setMembers([]); setError(err.response?.data?.message || 'Unable to load member records.'); }
      } finally { if (alive) setLoading(false); }
    }, search ? 250 : 0);
    return () => { alive = false; clearTimeout(timer); };
  }, [permitted, search, refresh, showArchived]);

  const switchView = () => {
    setShowArchived(value => !value);
    setSearch('');
    setForm(null);
    setMessage('');
    setMembers([]);
  };
  const openArchive = (member, restore = false) => {
    setArchiveAction({ member, restore });
    setArchiveError('');
  };
  const confirmArchive = async () => {
    if (!archiveAction || archiving) return;
    setArchiving(true);
    setArchiveError('');
    try {
      const { member, restore } = archiveAction;
      await axios.post(`${endpoint}/${member._id}/${restore ? 'restore' : 'archive'}`);
      setMembers(rows => rows.filter(row => row._id !== member._id));
      if (form?._id === member._id) setForm(null);
      setMessage(restore ? 'Member restored with its previous active/inactive status.' : 'Member archived. The card is no longer available at checkout.');
      setArchiveAction(null);
      setRefresh(value => value + 1);
    } catch (err) { setArchiveError(err.response?.data?.message || 'Unable to update the archive. Please try again.'); }
    finally { setArchiving(false); }
  };

  const edit = member => {
    setForm(member ? { ...member } : { ...blank });
    setFormError('');
    setFieldErrors({});
    setMessage('');
    requestAnimationFrame(() => nameInput.current?.focus());
  };
  const save = async event => {
    event.preventDefault();
    if (saving) return;
    const values = { name: form.name.trim(), idNumber: form.idNumber, email: (form.email || '').trim(), status: form.status, notes: (form.notes || '').trim() };
    const errors = {};
    if (!values.name) errors.name = 'Please enter the member’s name.';
    else if (!isValidMemberName(values.name)) errors.name = MEMBER_NAME_ERROR;
    if (!values.idNumber) errors.idNumber = 'Please enter the card ID.';
    else if (!/^[0-9]{1,12}$/.test(values.idNumber)) errors.idNumber = 'Card ID must contain 1–12 digits.';
    if (!isValidMemberEmail(values.email)) errors.email = MEMBER_EMAIL_ERROR;
    setFieldErrors(errors);
    setFormError('');
    if (Object.keys(errors).length) { (errors.name ? nameInput : errors.idNumber ? cardInput : emailInput).current?.focus(); return; }
    setSaving(true);
    setFormError('');
    try {
      if (form._id) await axios.patch(`${endpoint}/${form._id}`, values);
      else await axios.post(endpoint, values);
      setMessage(form._id ? 'Member updated. Future checkouts use the updated card status and details.' : 'Issued card registered. Staff can now select this member when the card is active.');
      setForm(null);
      setRefresh(value => value + 1);
    } catch (err) { setFormError(err.response?.data?.message || 'Unable to save this member. Please try again.'); }
    finally { setSaving(false); }
  };

  return <div className="mobile-app-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Segoe UI, sans-serif', background: '#F5F0EB' }}>
    <Sidebar />
    <main className="mobile-page-content elite-members-page">
      <PageHeader title={showArchived ? 'Archived Elite Members' : 'Elite Members'} description="Register issued membership cards and maintain their details and status." actions={permitted && <>
        <button onClick={switchView} disabled={saving || archiving}>{showArchived ? 'Registered members' : 'Archived members'}</button>
        {!showArchived && <button className="elite-primary" onClick={() => edit(null)} disabled={saving || archiving}>Register card</button>}
      </>} />
      {!permitted ? <p role="alert">Elite Membership access is required to manage members.</p> : <>
        {showArchived && <p className="elite-explanation">Archived cards cannot receive the Elite discount. Restore a record to return it to the registered list with its previous active/inactive status.</p>}
        {message && <p className="elite-success" role="status">{message}</p>}
        {error && <p className="elite-error" role="alert">{error}</p>}
        {form && <form className="elite-member-form" noValidate onSubmit={save} aria-label={form._id ? 'Edit member' : 'Register issued card'}>
          <h2>{form._id ? 'Edit member' : 'Register issued card'}</h2>
          <div className="elite-form-grid">
            <label>Member name<input ref={nameInput} required maxLength={120} value={form.name} disabled={saving} aria-label="Member name" aria-invalid={Boolean(fieldErrors.name)} aria-describedby={`member-name-help${fieldErrors.name ? ' member-name-error' : ''}`} onChange={event => {
              const value = event.target.value;
              if (!isAllowedMemberNameInput(value)) { setFieldErrors(previous => ({ ...previous, name: MEMBER_NAME_ERROR })); setFormError(''); return; }
              setForm({ ...form, name: value });
              setFieldErrors(previous => ({ ...previous, name: '' }));
              setFormError('');
            }} /><FieldError id="member-name-error" message={fieldErrors.name} /><small id="member-name-help">Letters, spaces, apostrophes, periods and hyphens only.</small></label>
            <label>Card ID<input ref={cardInput} required inputMode="numeric" pattern="[0-9]{1,12}" maxLength={12} value={form.idNumber} disabled={saving} aria-label="Card ID" aria-invalid={Boolean(fieldErrors.idNumber)} aria-describedby={`member-card-help${fieldErrors.idNumber ? ' member-card-error' : ''}`} onChange={event => {
              setForm({ ...form, idNumber: event.target.value.replace(/[^0-9]/g, '').slice(0, 12) });
              setFieldErrors(previous => ({ ...previous, idNumber: '' }));
              setFormError('');
            }} /><FieldError id="member-card-error" message={fieldErrors.idNumber} /><small id="member-card-help">1–12 digits. Leading zeroes are preserved.</small></label>
            <label>Status<select value={form.status} disabled={saving} onChange={event => setForm({ ...form, status: event.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          </div>
          <label>Email address (optional)<input ref={emailInput} type="email" maxLength={254} value={form.email || ''} disabled={saving} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'member-email-error' : undefined} onChange={event => {
            setForm({ ...form, email: event.target.value });
            setFieldErrors(previous => ({ ...previous, email: '' }));
            setFormError('');
          }} /><FieldError id="member-email-error" message={fieldErrors.email} /></label>
          <label>Notes (optional)<textarea maxLength={500} value={form.notes || ''} disabled={saving} onChange={event => setForm({ ...form, notes: event.target.value })} /></label>
          {formError && <p role="alert" className="elite-error">{formError}</p>}
          <div className="elite-form-actions"><button type="button" disabled={saving} onClick={() => setForm(null)}>Cancel</button><button className="elite-primary" disabled={saving}>{saving ? 'Saving…' : 'Save member'}</button></div>
        </form>}
        <section className="elite-members-table">
          <div className="elite-member-search"><label htmlFor="member-search">Search registered members</label><input id="member-search" type="search" maxLength={120} value={search} onChange={event => setSearch(event.target.value)} placeholder="Member name or card ID" /><button onClick={() => setRefresh(value => value + 1)} disabled={loading}>Refresh</button></div>
          <div className="data-scroll-box" tabIndex={0} role="region" aria-label="Elite Member records">
            <table><thead><tr><th>Member name</th><th>Card ID</th><th>Email address</th><th>Status</th><th>Notes</th><th>Actions</th></tr></thead>
              <tbody>{loading ? <tr><td colSpan={6}>Loading members…</td></tr> : members.length === 0 ? <tr><td colSpan={6}>{showArchived ? 'No archived members found.' : 'No members found.'}</td></tr> : members.map(member => <tr key={member._id}>
                <td>{member.name}</td><td>{member.idNumber}</td><td>{member.email || '—'}</td><td><span className={`elite-status ${showArchived ? 'archived' : member.status}`}>{showArchived ? 'Archived' : member.status === 'active' ? 'Active' : 'Inactive'}</span></td><td>{member.notes || '—'}</td><td><div className="elite-row-actions">
                  {showArchived ? <button disabled={saving || archiving} onClick={() => openArchive(member, true)} aria-label={`Restore ${member.name}, card ${member.idNumber}`}>Restore</button> : <>
                    <button disabled={saving || archiving} onClick={() => edit(member)} aria-label={`Edit ${member.name}, card ${member.idNumber}`}>Edit</button>
                    <button className="elite-archive-button" disabled={saving || archiving} onClick={() => openArchive(member)} aria-label={`Archive ${member.name}, card ${member.idNumber}`}>Archive</button>
                  </>}
                </div></td>
              </tr>)}</tbody>
            </table>
          </div>
          {members.length >= 100 && <p className="elite-explanation">Showing the first 100 matches. Narrow your search to find another card.</p>}
        </section>
        {archiveAction && <div className="elite-archive-overlay">
          <section className="elite-archive-dialog" role="dialog" aria-modal="true" aria-labelledby="elite-archive-title" aria-describedby="elite-archive-description" onKeyDown={event => {
            if (event.key === 'Escape' && !archiving) setArchiveAction(null);
            if (event.key !== 'Tab') return;
            const buttons = Array.from(event.currentTarget.querySelectorAll('button:not(:disabled)'));
            if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1]?.focus(); }
            else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0]?.focus(); }
          }}>
            <h2 id="elite-archive-title">{archiveAction.restore ? 'Restore member?' : 'Archive member?'}</h2>
            <p><strong>{archiveAction.member.name}</strong> — Card {archiveAction.member.idNumber}</p>
            <p id="elite-archive-description">{archiveAction.restore ? 'This returns the member to the registered list with its previous active/inactive status.' : 'This hides the member from the registered list and prevents use of this card at checkout. You can restore it later. Previous sales remain unchanged.'}</p>
            {archiveError && <p role="alert" className="elite-error">{archiveError}</p>}
            <div className="elite-form-actions"><button ref={archiveCancel} disabled={archiving} onClick={() => setArchiveAction(null)}>Cancel</button><button className="elite-primary" disabled={archiving} onClick={confirmArchive}>{archiving ? 'Saving…' : archiveAction.restore ? 'Restore member' : 'Archive member'}</button></div>
          </section>
        </div>}
      </>}
    </main>
  </div>;
}
