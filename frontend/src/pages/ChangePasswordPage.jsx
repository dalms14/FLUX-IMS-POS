import ValidatedForm from '../components/ValidatedForm';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './ChangePasswordPage.css';

const API = 'http://localhost:5000/api/auth';

const ChangePasswordPage = () => {
  const [step, setStep] = useState('request');
  const [form, setForm] = useState({ email: '', otp: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const update = (field, value) => {
    setForm(current => ({ ...current, [field]: value }));
    setError('');
    setSuccess('');
  };

  const requestCode = async () => {
    if (!form.email.trim()) return setError('Enter the email address saved on your account.');
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.post(`${API}/password-reset/request`, { email: form.email });
      setSuccess(data.message);
      setStep('verify');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to send a code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (form.otp.replace(/\D/g, '').length !== 6) return setError('Enter the six-digit code from your email.');
    if (form.newPassword !== form.confirmPassword) return setError('The new passwords do not match.');
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.post(`${API}/password-reset/confirm`, {
        email: form.email,
        otp: form.otp,
        newPassword: form.newPassword,
      });
      setSuccess(data.message);
      setStep('done');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to reset the password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const submit = event => {
    event.preventDefault();
    if (step === 'request') requestCode();
    else if (step === 'verify') resetPassword();
  };

  const useDifferentEmail = () => {
    setStep('request');
    setForm(current => ({ ...current, otp: '', newPassword: '', confirmPassword: '' }));
    setError('');
    setSuccess('');
  };

  const title = step === 'request' ? 'Forgot password?' : step === 'verify' ? 'Reset password' : 'Password updated';
  const description = step === 'request'
    ? "Enter your account email to receive a verification code."
    : step === 'verify'
      ? 'Enter your code and choose a new password.'
      : 'You can now sign in with your new password.';

  return <main className="password-reset-page">
    <section className="password-reset-shell" aria-labelledby="password-reset-title">
      <p className="password-reset-brand">FLUX</p>
      <div className="password-reset-heading">
        <h1 id="password-reset-title">{title}</h1>
        <p>{description}</p>
      </div>

      {error && <div className="password-reset-notice is-error" role="alert">{error}</div>}
      {success && step !== 'done' && <div className="password-reset-notice is-success" role="status">{success}</div>}

      {step === 'request' && <ValidatedForm className="password-reset-form" onSubmit={submit}>
        <div className="password-reset-field">
          <label htmlFor="reset-email">Email address</label>
          <input id="reset-email" type="email" autoComplete="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="name@example.com" autoFocus />
        </div>
        <button type="submit" className="password-reset-primary" disabled={loading}>
          {loading ? 'Sending code...' : 'Send verification code'}
        </button>
      </ValidatedForm>}

      {step === 'verify' && <ValidatedForm className="password-reset-form" onSubmit={submit}>
        <div className="password-reset-destination">
          <span>{form.email}</span>
          <button type="button" onClick={useDifferentEmail}>Change email</button>
        </div>
        <div className="password-reset-field">
          <label htmlFor="reset-code">Verification code</label>
          <input id="reset-code" className="password-reset-code-input" inputMode="numeric" autoComplete="one-time-code" maxLength="6" value={form.otp} onChange={e => update('otp', e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" autoFocus />
        </div>
        <div className="password-reset-field">
          <label htmlFor="new-password">New password</label>
          <input id="new-password" type="password" autoComplete="new-password" value={form.newPassword} onChange={e => update('newPassword', e.target.value)} aria-describedby="reset-password-hint" />
          <small id="reset-password-hint">At least 8 characters, with uppercase, lowercase and a number.</small>
        </div>
        <div className="password-reset-field">
          <label htmlFor="confirm-password">Confirm password</label>
          <input id="confirm-password" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} />
        </div>
        <button type="submit" className="password-reset-primary" disabled={loading}>
          {loading ? 'Updating password...' : 'Update password'}
        </button>
        <button type="button" className="password-reset-secondary" disabled={loading} onClick={requestCode}>Send a new code</button>
      </ValidatedForm>}

      {step === 'done' && <button type="button" className="password-reset-primary password-reset-continue" onClick={() => navigate('/login')}>Continue to login</button>}
      {step !== 'done' && <button type="button" className="password-reset-back" onClick={() => navigate('/login')}>Back to login</button>}
    </section>
  </main>;
};

export default ChangePasswordPage;
