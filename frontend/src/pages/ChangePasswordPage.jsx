import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = 'http://localhost:5000/api/auth';

const ChangePasswordPage = () => {
  const [step, setStep] = useState('request');
  const [form, setForm] = useState({ email: '', otp: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const update = (field, value) => { setForm(current => ({ ...current, [field]: value })); setError(''); setSuccess(''); };

  const requestCode = async () => {
    if (!form.email.trim()) return setError('Enter the email address saved on your account.');
    setLoading(true); setError('');
    try {
      const { data } = await axios.post(`${API}/password-reset/request`, { email: form.email });
      setSuccess(data.message);
      setStep('verify');
    } catch (err) { setError(err.response?.data?.message || 'Unable to send a code. Please try again.'); }
    finally { setLoading(false); }
  };

  const resetPassword = async () => {
    if (form.otp.replace(/\D/g, '').length !== 6) return setError('Enter the six-digit code from your email.');
    if (form.newPassword !== form.confirmPassword) return setError('The new passwords do not match.');
    setLoading(true); setError('');
    try {
      const { data } = await axios.post(`${API}/password-reset/confirm`, { email: form.email, otp: form.otp, newPassword: form.newPassword });
      setSuccess(data.message); setStep('done');
    } catch (err) { setError(err.response?.data?.message || 'Unable to reset the password. Please try again.'); }
    finally { setLoading(false); }
  };

  const submit = event => { event.preventDefault(); if (step === 'request') requestCode(); else if (step === 'verify') resetPassword(); };
  const inputStyle = { width: '100%', padding: '11px 14px', border: '1.5px solid #ddd', borderRadius: '8px', fontSize: '14px', outline: 'none', backgroundColor: '#fff', boxSizing: 'border-box', marginTop: '6px' };
  const labelStyle = { fontSize: '13px', fontWeight: '700', color: '#555' };
  const buttonStyle = { width: '100%', padding: '12px', backgroundColor: loading ? '#c4a882' : '#8B5E3C', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '800', cursor: loading ? 'not-allowed' : 'pointer', marginBottom: '12px' };

  return <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Segoe UI, sans-serif' }}>
    <div style={{ width: '50%', backgroundColor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '280px', height: '280px', backgroundColor: '#fff', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <img src="/eli-coffee-logo.png" alt="Eli Coffee Logo" style={{ width: '220px', height: '220px', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none'; }} />
      </div>
    </div>
    <div style={{ width: '50%', backgroundColor: '#C4A87A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
      <div style={{ backgroundColor: '#FDF8F2', borderRadius: '16px', padding: '34px 40px', width: '100%', maxWidth: '400px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1a1a1a', margin: '0 0 4px', textAlign: 'center' }}>Reset Password</h2>
        <p style={{ margin: '0 0 20px', textAlign: 'center', color: '#8A7A6B', fontSize: '13px', lineHeight: 1.5 }}>
          {step === 'request' ? 'We will send a one-time code to the email already saved on your account.' : step === 'verify' ? `Enter the code sent to ${form.email}. It expires in 10 minutes.` : 'Your password was changed successfully.'}
        </p>
        {error && <div style={{ backgroundColor: '#fff1f1', border: '1px solid #fca5a5', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', fontWeight: '600' }}>{error}</div>}
        {success && <div style={{ backgroundColor: '#F0FFF4', border: '1px solid #C6F6D5', color: '#276749', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', fontWeight: '700' }}>{success}</div>}
        {step !== 'done' && <form onSubmit={submit}>
          <div style={{ marginBottom: '14px' }}><label style={labelStyle}>Account Email</label><input type="email" autoComplete="email" value={form.email} onChange={e => update('email', e.target.value)} style={inputStyle} placeholder="your@email.com" disabled={step === 'verify'} /></div>
          {step === 'verify' && <>
            <div style={{ marginBottom: '14px' }}><label style={labelStyle}>Verification Code</label><input inputMode="numeric" autoComplete="one-time-code" maxLength="6" value={form.otp} onChange={e => update('otp', e.target.value.replace(/\D/g, '').slice(0, 6))} style={{ ...inputStyle, letterSpacing: '6px', textAlign: 'center', fontWeight: '800' }} placeholder="000000" /></div>
            <div style={{ marginBottom: '14px' }}><label style={labelStyle}>New Password</label><input type="password" autoComplete="new-password" value={form.newPassword} onChange={e => update('newPassword', e.target.value)} style={inputStyle} placeholder="At least 8 characters" /></div>
            <div style={{ marginBottom: '20px' }}><label style={labelStyle}>Confirm New Password</label><input type="password" autoComplete="new-password" value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} style={inputStyle} placeholder="Repeat new password" /></div>
            <p style={{ fontSize: '11px', color: '#777', margin: '-8px 0 16px' }}>Use 8+ characters, with uppercase, lowercase, and a number.</p>
          </>}
          <button type="submit" disabled={loading} style={buttonStyle}>{loading ? 'Please wait...' : step === 'request' ? 'Send Verification Code' : 'Reset Password'}</button>
          {step === 'verify' && <button type="button" disabled={loading} onClick={requestCode} style={{ ...buttonStyle, backgroundColor: 'transparent', color: '#8B5E3C', border: '1px solid #8B5E3C' }}>Send a New Code</button>}
        </form>}
        <button type="button" onClick={() => navigate('/login')} style={{ width: '100%', padding: '10px', backgroundColor: 'transparent', color: '#8B5E3C', border: 'none', fontSize: '13px', cursor: 'pointer', fontWeight: '700' }}>Back to Login</button>
      </div>
    </div>
  </div>;
};

export default ChangePasswordPage;
