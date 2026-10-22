import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FiLock } from 'react-icons/fi';
import { clearSession, getSessionUser, startSession } from '../utils/session';
import { getLandingPath } from '../utils/roles';
import './FirstLoginPasswordPage.css';

const readChallenge = () => {
  try { return JSON.parse(sessionStorage.getItem('firstLoginChallenge') || 'null'); }
  catch { return null; }
};

export default function FirstLoginPasswordPage() {
  const [challenge] = useState(readChallenge);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [expired, setExpired] = useState(false);
  const navigate = useNavigate();
  const savedUser = getSessionUser();
  if (savedUser) return <Navigate to={getLandingPath(savedUser)} replace />;
  if (!challenge?.token) return <Navigate to="/login" replace />;

  const submit = async event => {
    event.preventDefault();
    if (newPassword !== confirmPassword) return setError('New passwords do not match.');
    if (newPassword.length < 8 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return setError('Use at least 8 characters, including uppercase, lowercase, and a number.');
    }
    setSaving(true);
    setError('');
    try {
      const response = await axios.post('http://localhost:5000/api/auth/first-login-password', {
        token: challenge.token, newPassword, confirmPassword,
      });
      startSession(response.data.user);
      navigate(getLandingPath(response.data.user), { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change your password. Please try again.');
      if (err.response?.status === 401) {
        sessionStorage.removeItem('firstLoginChallenge');
        setExpired(true);
      }
    } finally { setSaving(false); }
  };

  return <main className="first-login-page">
    <section className="first-login-card" aria-labelledby="first-login-title">
      <div className="first-login-brand">FLUX <span>ELI COFFEE</span></div>
      <span className="first-login-icon"><FiLock aria-hidden="true" /></span>
      <p className="first-login-eyebrow">FIRST SIGN-IN</p>
      <h1 id="first-login-title">Make this account yours</h1>
      <p className="first-login-description">Replace your temporary password before continuing. Your new password will be used for future sign-ins.</p>
      <p className="first-login-email">{challenge.email}</p>
      <form onSubmit={submit}>
        <label htmlFor="first-new-password">New password</label>
        <input id="first-new-password" type="password" autoComplete="new-password" autoFocus required minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} disabled={saving || expired} aria-describedby="first-password-help" />
        <p id="first-password-help" className="first-login-help">At least 8 characters with uppercase, lowercase, and a number. Must differ from your temporary password.</p>
        <label htmlFor="first-confirm-password">Confirm new password</label>
        <input id="first-confirm-password" type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} disabled={saving || expired} />
        {error && <p role="alert" className="first-login-error">{error}</p>}
        <button className="first-login-save" type="submit" disabled={saving || expired}>{saving ? 'Saving password...' : 'Save password and continue'}</button>
        <button className="first-login-back" type="button" disabled={saving} onClick={() => { clearSession(); navigate('/login', { replace: true }); }}>Back to sign in</button>
      </form>
    </section>
  </main>;
}
