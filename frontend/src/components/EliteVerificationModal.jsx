import React, { useState } from 'react';
import {
  ELITE_CARD_ID_MAX_LENGTH, getEliteMemberHistory, isValidEliteMember,
  removeEliteMember, saveEliteMember,
} from '../utils/eliteMemberHistory';
import './EliteVerificationModal.css';

export default function EliteVerificationModal({ onConfirm, onCancel }) {
  const [name, setName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [history, setHistory] = useState(getEliteMemberHistory);
  const [selectedId, setSelectedId] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');

  const applyMember = event => {
    const member = history.find(item => item.idNumber === event.target.value);
    setSelectedId(member?.idNumber || '');
    setName(member?.name || '');
    setIdNumber(member?.idNumber || '');
    setError('');
  };

  const handleRemove = () => {
    try {
      setHistory(removeEliteMember(selectedId));
      setSelectedId('');
      setName('');
      setIdNumber('');
      setError('');
    } catch {
      setError('Could not remove the saved member. Please try again.');
    }
  };

  const handleConfirm = event => {
    event.preventDefault();
    const member = { name: name.trim(), idNumber };
    if (!isValidEliteMember(member)) {
      setError('Enter a member name and a card ID containing 1 to 12 digits.');
      return;
    }
    if (remember) {
      try {
        setHistory(saveEliteMember(member));
      } catch {
        setError('Could not save member details. Uncheck “Save member for next time” to continue without saving.');
        return;
      }
    }
    onConfirm(member);
  };

  return (
    <div className="elite-verification-overlay">
      <form noValidate onSubmit={handleConfirm} role="dialog" aria-modal="true" aria-labelledby="elite-verification-title" className="mobile-modal-card cashier-dialog elite-verification-dialog">
        <h3 id="elite-verification-title">Elite Membership Verification</h3>
        <div className="elite-verification-divider" />
        {history.length > 0 && <div className="elite-verification-field">
          <label htmlFor="elite-saved-member">Saved member</label>
          <div className="elite-member-picker">
            <select id="elite-saved-member" value={selectedId} onChange={applyMember}>
              <option value="">Choose a member (optional)</option>
              {history.map(member => <option key={member.idNumber} value={member.idNumber}>{member.name} — {member.idNumber}</option>)}
            </select>
            <button type="button" className="cashier-secondary" disabled={!selectedId} onClick={handleRemove} aria-label="Remove saved member">Remove</button>
          </div>
        </div>}
        <div className="elite-verification-field">
          <label htmlFor="elite-member-name">Name:</label>
          <input id="elite-member-name" value={name} onChange={event => { setName(event.target.value); setSelectedId(''); setError(''); }} placeholder="Enter member name" autoComplete="off" />
        </div>
        <div className="elite-verification-field">
          <label htmlFor="elite-card-id">ID Number:</label>
          <input id="elite-card-id" type="text" inputMode="numeric" maxLength={ELITE_CARD_ID_MAX_LENGTH} pattern="[0-9]{1,12}" value={idNumber} onChange={event => {
            setIdNumber(event.target.value.replace(/[^0-9]/g, '').slice(0, ELITE_CARD_ID_MAX_LENGTH));
            setSelectedId('');
            setError('');
          }} placeholder="Enter card ID number" autoComplete="off" aria-describedby="elite-card-id-help" />
          <p id="elite-card-id-help" className="elite-verification-help">Up to 12 digits.</p>
        </div>
        <label className="elite-member-remember">
          <input type="checkbox" checked={remember} onChange={event => { setRemember(event.target.checked); setError(''); }} />
          Save member for next time
        </label>
        <p className="elite-verification-help">Saved members are available on this browser.</p>
        {error && <p role="alert" className="elite-verification-error">{error}</p>}
        <div className="elite-verification-actions">
          <button type="button" className="cashier-secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="elite-verification-confirm">Confirm</button>
        </div>
      </form>
    </div>
  );
}
