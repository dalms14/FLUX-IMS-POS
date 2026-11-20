import ValidatedForm from './ValidatedForm';
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { FiCheck, FiChevronDown, FiCreditCard, FiUser } from 'react-icons/fi';
import { canManageEliteMembers } from '../utils/roles';
import { getSessionUser } from '../utils/session';
import { isValidEliteMember } from '../utils/eliteMemberHistory';
import './EliteVerificationModal.css';

function EliteMemberPicker({ members, selectedId, disabled, loading, onChange }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(null);
  const selected = members.find(member => member.idNumber === selectedId);
  const expanded = open && !disabled;
  const listId = 'elite-registered-member-options';

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (expanded) document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [expanded, activeIndex]);

  useEffect(() => {
    const closeOutside = event => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, []);

  const toggle = () => {
    setActiveIndex(Math.max(0, members.findIndex(member => member.idNumber === selectedId)));
    setOpen(current => !current);
  };
  const choose = member => {
    onChange(member.idNumber);
    setOpen(false);
    rootRef.current?.querySelector('[role="combobox"]')?.focus();
  };

  return (
    <div className={`elite-member-select${expanded ? ' is-open' : ''}`} ref={rootRef}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <button id="elite-registered-member" type="button" role="combobox" className="elite-member-trigger"
        disabled={disabled || members.length === 0} aria-labelledby="elite-registered-member-label"
        aria-haspopup="listbox" aria-expanded={expanded} aria-controls={expanded ? listId : undefined}
        aria-activedescendant={expanded ? `${listId}-${activeIndex}` : undefined}
        onClick={toggle} onKeyDown={event => {
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex(current => event.key === 'Home' ? 0 : event.key === 'End' ? members.length - 1
              : !expanded ? Math.max(0, members.findIndex(member => member.idNumber === selectedId))
                : (current + (event.key === 'ArrowDown' ? 1 : -1) + members.length) % members.length);
          } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (expanded && members[activeIndex]) choose(members[activeIndex]);
            else toggle();
          } else if (event.key === 'Escape' && expanded) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          } else if (event.key === 'Tab') setOpen(false);
        }}>
        <span className="elite-member-trigger-icon" aria-hidden="true"><FiCreditCard /></span>
        <span className="elite-member-copy">
          <strong>{selected?.name || (loading ? 'Loading members…' : members.length ? 'Select an active member' : 'No active members found')}</strong>
          <small>{selected ? `Card ID: ${selected.idNumber}` : 'Choose the member matching the issued card'}</small>
        </span>
        <FiChevronDown className="elite-member-chevron" aria-hidden="true" />
      </button>
      {expanded && <div id={listId} role="listbox" aria-labelledby="elite-registered-member-label" className="elite-member-menu">
        {members.map((member, index) => <button key={member.idNumber} id={`${listId}-${index}`}
          type="button" role="option" tabIndex={-1} aria-selected={member.idNumber === selectedId}
          className={`elite-member-option${index === activeIndex ? ' is-active' : ''}${member.idNumber === selectedId ? ' is-selected' : ''}`}
          onMouseEnter={() => setActiveIndex(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(member)}>
          <span className="elite-member-option-icon" aria-hidden="true"><FiUser /></span>
          <span className="elite-member-copy"><strong>{member.name}</strong><small>Card ID: {member.idNumber}</small></span>
          {member.idNumber === selectedId && <FiCheck className="elite-member-check" aria-hidden="true" />}
        </button>)}
      </div>}
    </div>
  );
}

export default function EliteVerificationModal({ onConfirm, onCancel }) {
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const selected = members.find(member => member.idNumber === selectedId);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setSelectedId('');
    setMembers([]);
    setError('');
    const timer = setTimeout(async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/elite-members?search=${encodeURIComponent(search.trim())}`);
        if (alive) setMembers(response.data.data || []);
      } catch (err) {
        if (alive) setError(err.response?.data?.message || 'Unable to load registered members. Please try again.');
      } finally { if (alive) setLoading(false); }
    }, search ? 250 : 0);
    return () => { alive = false; clearTimeout(timer); };
  }, [search, refresh]);

  const handleConfirm = async event => {
    event.preventDefault();
    if (!selected || verifying || loading) return;
    setVerifying(true);
    setError('');
    try {
      const response = await axios.post('http://localhost:5000/api/elite-members/verify', { idNumber: selected.idNumber });
      if (!isValidEliteMember(response.data?.member)) throw new Error('Invalid verification response');
      onConfirm(response.data.member);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to verify this member. Please try again.');
    } finally { setVerifying(false); }
  };

  return (
    <div className="elite-verification-overlay">
      <ValidatedForm onSubmit={handleConfirm} onKeyDown={event => {
        if (event.key === 'Escape' && !verifying) onCancel();
        if (event.key !== 'Tab') return;
        const controls = Array.from(event.currentTarget.querySelectorAll('input:not(:disabled), select:not(:disabled), button:not(:disabled), a[href]')).filter(control => control.tabIndex >= 0);
        if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls[controls.length - 1]?.focus(); }
        else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) { event.preventDefault(); controls[0]?.focus(); }
      }} role="dialog" aria-modal="true" aria-labelledby="elite-verification-title" className="mobile-modal-card cashier-dialog elite-verification-dialog">
        <h3 id="elite-verification-title">Elite Membership Verification</h3>
        <div className="elite-verification-divider" />
        <p className="elite-verification-help" style={{ marginBottom: '16px' }}>Match the customer's issued card to an active registered member before applying the Elite discount.</p>
        <div className="elite-verification-field">
          <label htmlFor="elite-member-search">Search card ID</label>
          <input autoFocus id="elite-member-search" type="text" inputMode="numeric" pattern="[0-9]{1,12}" value={search} maxLength={12} disabled={verifying} onChange={event => setSearch(event.target.value.replace(/[^0-9]/g, '').slice(0, 12))} placeholder="Enter up to 12 digits" autoComplete="off" />
        </div>
        <div className="elite-verification-field">
          <label id="elite-registered-member-label" htmlFor="elite-registered-member">Registered member</label>
          <EliteMemberPicker members={members} selectedId={selectedId} disabled={loading || verifying} loading={loading}
            onChange={id => { setSelectedId(id); setError(''); }} />
        </div>
        {!loading && !error && members.length === 0 && <p role="status" className="elite-verification-help">No active members found. Ask the owner or an authorized membership manager to register or reactivate the issued card.</p>}
        {members.length >= 100 && <p className="elite-verification-help">Showing the first 100 matches. Search by card ID to narrow the list.</p>}
        {canManageEliteMembers(getSessionUser() || {}) && <p className="elite-verification-help"><a href="/elite-members">Manage Elite Members</a></p>}
        {error && <p role="alert" className="elite-verification-error">{error}</p>}
        {error && <button type="button" disabled={loading || verifying} onClick={() => setRefresh(value => value + 1)}>Refresh members</button>}
        <div className="elite-verification-actions">
          <button type="button" className="cashier-secondary" disabled={verifying} onClick={onCancel}>Cancel</button>
          <button type="submit" className="elite-verification-confirm" disabled={!selected || loading || verifying}>{verifying ? 'Verifying…' : 'Confirm'}</button>
        </div>
      </ValidatedForm>
    </div>
  );
}
