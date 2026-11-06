import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { canManageEliteMembers } from '../utils/roles';
import { getSessionUser } from '../utils/session';
import { isValidEliteMember } from '../utils/eliteMemberHistory';
import './EliteVerificationModal.css';

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
      <form onSubmit={handleConfirm} onKeyDown={event => {
        if (event.key === 'Escape' && !verifying) onCancel();
        if (event.key !== 'Tab') return;
        const controls = Array.from(event.currentTarget.querySelectorAll('input:not(:disabled), select:not(:disabled), button:not(:disabled), a[href]'));
        if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls[controls.length - 1]?.focus(); }
        else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) { event.preventDefault(); controls[0]?.focus(); }
      }} role="dialog" aria-modal="true" aria-labelledby="elite-verification-title" className="mobile-modal-card cashier-dialog elite-verification-dialog">
        <h3 id="elite-verification-title">Elite Membership Verification</h3>
        <div className="elite-verification-divider" />
        <p className="elite-verification-help" style={{ marginBottom: '16px' }}>Match the customer's issued card to an active registered member before applying the Elite discount.</p>
        <div className="elite-verification-field">
          <label htmlFor="elite-member-search">Search name or card ID</label>
          <input autoFocus id="elite-member-search" value={search} maxLength={120} disabled={verifying} onChange={event => setSearch(event.target.value)} placeholder="Enter a name or card ID" autoComplete="off" />
        </div>
        <div className="elite-verification-field">
          <label htmlFor="elite-registered-member">Registered member</label>
          <select id="elite-registered-member" value={selectedId} disabled={loading || verifying} onChange={event => { setSelectedId(event.target.value); setError(''); }}>
            <option value="">{loading ? 'Loading members…' : 'Select an active member'}</option>
            {members.map(member => <option key={member.idNumber} value={member.idNumber}>{member.name} — {member.idNumber}</option>)}
          </select>
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
      </form>
    </div>
  );
}
