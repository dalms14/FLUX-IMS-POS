import React, { useEffect, useRef, useState } from 'react';
import { FiDownload, FiEye, FiEyeOff, FiLock, FiX } from 'react-icons/fi';
import './BackupExportModal.css';

export default function BackupExportModal({ busy, error, onConfirm, onClose }) {
  const dialog = useRef(null);
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => { if (element.open) element.close(); };
  }, []);

  return <dialog ref={dialog} className="backup-export-modal" aria-labelledby="backup-export-title" aria-describedby="backup-export-description" onCancel={event => {
    event.preventDefault();
    if (!busy) onClose();
  }} onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <form onSubmit={event => { event.preventDefault(); if (password && !busy) onConfirm(password); }}>
      <div className="backup-export-header">
        <span className="backup-export-icon"><FiLock aria-hidden="true" /></span>
        <button className="backup-export-close" type="button" onClick={onClose} disabled={busy} aria-label="Close backup export"><FiX /></button>
      </div>
      <p className="backup-export-eyebrow">OWNER CONFIRMATION</p>
      <h2 id="backup-export-title">Export database backup</h2>
      <p id="backup-export-description">Enter your owner password to download a copy of your business records.</p>
      <div className="backup-export-file"><FiDownload aria-hidden="true" /><div><strong>FLUX backup file</strong><span>JSON file · Products, inventory, sales, and other records</span></div></div>
      <label htmlFor="backup-owner-password">Owner password</label>
      <div className="backup-export-password">
        <input id="backup-owner-password" type={visible ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" autoFocus required disabled={busy} aria-invalid={Boolean(error)} aria-describedby={error ? 'backup-export-error' : undefined} />
        <button type="button" onClick={() => setVisible(value => !value)} disabled={busy} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <FiEyeOff /> : <FiEye />}</button>
      </div>
      {error && <p id="backup-export-error" className="backup-export-error" role="alert">{error}</p>}
      <div className="backup-export-actions">
        <button type="button" className="backup-export-cancel" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" className="backup-export-confirm" disabled={busy || !password}><FiDownload aria-hidden="true" />{busy ? 'Exporting...' : 'Export backup'}</button>
      </div>
    </form>
  </dialog>;
}
