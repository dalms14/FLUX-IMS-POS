import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Check, CheckCircle2, LockKeyhole, Mail } from 'lucide-react';
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

  const title = step === 'request' ? 'Forgot your password?' : step === 'verify' ? 'Create a new password' : 'Password updated';
  const description = step === 'request'
    ? 'Enter the email connected to your FLUX account. We will send you a secure six-digit verification code.'
    : step === 'verify'
      ? 'Enter the code from your email and choose a new password for your account.'
      : 'Your password has been changed. You can now sign in using your new password.';

  return <main className="password-reset-page">
    <section className="password-reset-shell" aria-label="FLUX password recovery">
      <header className="password-reset-topbar">
        <div className="password-reset-brand-lockup">
          <div className="password-reset-logo-card">
            <img className="password-reset-logo" src="/eli-coffee-bean-mark.png" alt="Eli Coffee bean logo" onError={e => { e.target.style.display = 'none'; }} />
          </div>
          <div>
            <span className="password-reset-brand-kicker">FLUX</span>
            <p className="password-reset-brand-label">Eli Coffee Staff Portal</p>
          </div>
        </div>

        <button type="button" className="password-reset-back" onClick={() => navigate('/login')}>
          <ArrowLeft size={17} aria-hidden="true" />
          Back to login
        </button>
      </header>

      <div className="password-reset-card">
        <div className={`password-reset-title-icon ${step === 'done' ? 'is-complete' : ''}`} aria-hidden="true">
          {step === 'done' ? <CheckCircle2 size={23} /> : <LockKeyhole size={22} />}
        </div>

        <div className="password-reset-heading">
          <span>{step === 'done' ? 'Complete' : step === 'verify' ? 'Verify your account' : 'Password recovery'}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>

          {error && <div className="password-reset-notice is-error" role="alert">{error}</div>}
          {success && step !== 'done' && <div className="password-reset-notice is-success" role="status"><Check size={17} />{success}</div>}

          {step === 'request' && <form className="password-reset-form" onSubmit={submit}>
            <div className="password-reset-field">
              <label htmlFor="reset-email">Account email</label>
              <div className="password-reset-input-wrap">
                <Mail size={19} aria-hidden="true" />
                <input id="reset-email" type="email" autoComplete="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="name@example.com" autoFocus />
              </div>
              <small>Use the email address registered to your account.</small>
            </div>
            <button type="submit" className="password-reset-primary" disabled={loading}>
              {loading ? <span className="password-reset-loading">Sending code…</span> : <>Send verification code <span aria-hidden="true">→</span></>}
            </button>
          </form>}

          {step === 'verify' && <form className="password-reset-form" onSubmit={submit}>
            <div className="password-reset-destination">
              <div><Mail size={18} aria-hidden="true" /><span><small>Code sent to</small><strong>{form.email}</strong></span></div>
              <button type="button" onClick={useDifferentEmail}>Change</button>
            </div>

            <div className="password-reset-field">
              <label htmlFor="reset-code">Verification code</label>
              <input id="reset-code" className="password-reset-code-input" inputMode="numeric" autoComplete="one-time-code" maxLength="6" value={form.otp} onChange={e => update('otp', e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" autoFocus />
            </div>

            <div className="password-reset-field">
              <label htmlFor="new-password">New password</label>
              <div className="password-reset-input-wrap">
                <LockKeyhole size={19} aria-hidden="true" />
                <input id="new-password" type="password" autoComplete="new-password" value={form.newPassword} onChange={e => update('newPassword', e.target.value)} placeholder="Enter a strong password" />
              </div>
            </div>

            <div className="password-reset-field">
              <label htmlFor="confirm-password">Confirm new password</label>
              <div className="password-reset-input-wrap">
                <LockKeyhole size={19} aria-hidden="true" />
                <input id="confirm-password" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} placeholder="Enter it one more time" />
              </div>
              <small>Use at least 8 characters with uppercase, lowercase, and a number.</small>
            </div>

            <button type="submit" className="password-reset-primary" disabled={loading}>
              {loading ? <span className="password-reset-loading">Updating password…</span> : 'Update password'}
            </button>
            <button type="button" className="password-reset-secondary" disabled={loading} onClick={requestCode}>Send a new code</button>
          </form>}

          {step === 'done' && <div className="password-reset-complete">
            <div className="password-reset-complete-check" aria-hidden="true"><Check size={22} /></div>
            <p>{success || 'Your password was changed successfully.'}</p>
            <button type="button" className="password-reset-primary" onClick={() => navigate('/login')}>Continue to login <span aria-hidden="true">→</span></button>
          </div>}

          <p className="password-reset-help">Need assistance? Contact your system administrator.</p>
      </div>
    </section>
  </main>;
};

export default ChangePasswordPage;
