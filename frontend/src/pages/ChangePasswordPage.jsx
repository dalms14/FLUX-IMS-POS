import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const ChangePasswordPage = () => {
  const [form, setForm] = useState({
    email: '',
    userId: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [identityVerified, setIdentityVerified] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
    setSuccess('');
  };

  const verifyIdentity = async () => {
    if (!form.email.trim() || !form.userId.trim()) {
      setError('Please enter your email address and user ID.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await axios.post('http://localhost:5000/api/auth/verify-identity', {
        email: form.email.trim().toLowerCase(),
        userId: form.userId.trim().toUpperCase(),
      });

      if (!res.data?.verified) {
        setError('We could not verify that account. Please check your email and user ID.');
        return;
      }

      setIdentityVerified(true);
      setSuccess('Account verified. You can now set a new password.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to verify account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!form.newPassword || !form.confirmPassword) {
      setError('Please enter and confirm your new password.');
      return;
    }

    if (form.newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await axios.post('http://localhost:5000/api/auth/reset-password', {
        email: form.email.trim().toLowerCase(),
        userId: form.userId.trim().toUpperCase(),
        newPassword: form.newPassword,
      });

      setSuccess('Password reset successfully. You can now sign in with your new password.');
      setForm({ email: '', userId: '', newPassword: '', confirmPassword: '' });
      setIdentityVerified(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (identityVerified) await resetPassword();
    else await verifyIdentity();
  };

  const inputStyle = {
    width: '100%',
    padding: '11px 14px',
    border: '1.5px solid #ddd',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: '#fff',
    boxSizing: 'border-box',
    marginTop: '6px',
  };

  const labelStyle = {
    fontSize: '13px',
    fontWeight: '700',
    color: '#555',
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{
        width: '50%',
        backgroundColor: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: '280px',
          height: '280px',
          backgroundColor: '#fff',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}>
          <img
            src="/eli-coffee-logo.png"
            alt="Eli Coffee Logo"
            style={{ width: '220px', height: '220px', objectFit: 'contain' }}
            onError={e => { e.target.style.display = 'none'; }}
          />
        </div>
      </div>

      <div style={{
        width: '50%',
        backgroundColor: '#C4A87A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
      }}>
        <div style={{
          backgroundColor: '#FDF8F2',
          borderRadius: '16px',
          padding: '34px 40px',
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1a1a1a', margin: '0 0 4px', textAlign: 'center' }}>
            Forgot Password
          </h2>
          <p style={{ margin: '0 0 20px', textAlign: 'center', color: '#8A7A6B', fontSize: '13px', lineHeight: 1.5 }}>
            {identityVerified
              ? 'Set a new password for your verified account.'
              : 'Enter your account email and user ID to verify your identity.'}
          </p>

          {error && (
            <div style={{ backgroundColor: '#fff1f1', border: '1px solid #fca5a5', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', fontWeight: '600' }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ backgroundColor: '#F0FFF4', border: '1px solid #C6F6D5', color: '#276749', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', fontWeight: '700' }}>
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Email Address</label>
              <input
                type="email"
                value={form.email}
                onChange={e => updateField('email', e.target.value)}
                style={inputStyle}
                placeholder="your@email.com"
                disabled={identityVerified}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>User ID</label>
              <input
                type="text"
                value={form.userId}
                onChange={e => updateField('userId', e.target.value)}
                style={inputStyle}
                placeholder="Example: ELI001"
                disabled={identityVerified}
              />
            </div>

            {identityVerified && (
              <>
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>New Password</label>
                  <input
                    type="password"
                    value={form.newPassword}
                    onChange={e => updateField('newPassword', e.target.value)}
                    style={inputStyle}
                    placeholder="Minimum 6 characters"
                  />
                </div>

                <div style={{ marginBottom: '22px' }}>
                  <label style={labelStyle}>Confirm New Password</label>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={e => updateField('confirmPassword', e.target.value)}
                    style={inputStyle}
                    placeholder="Re-enter new password"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: loading ? '#c4a882' : '#8B5E3C',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '800',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginBottom: '12px',
              }}
            >
              {loading ? 'Please wait...' : identityVerified ? 'Reset Password' : 'Verify Account'}
            </button>

            {identityVerified && (
              <button
                type="button"
                onClick={() => {
                  setIdentityVerified(false);
                  setForm(prev => ({ ...prev, newPassword: '', confirmPassword: '' }));
                  setError('');
                  setSuccess('');
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: 'transparent',
                  color: '#8B5E3C',
                  border: 'none',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: '700',
                }}
              >
                Use a different account
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate('/login')}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: 'transparent',
                color: '#8B5E3C',
                border: 'none',
                fontSize: '13px',
                cursor: 'pointer',
                fontWeight: '700',
              }}
            >
              Back to Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
