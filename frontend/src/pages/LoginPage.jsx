import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FiAlertTriangle, FiEye, FiEyeOff } from 'react-icons/fi';
import './LoginPage.module.css';

const normalizeLoginEmail = (value = '') => value.toLowerCase().trim();

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState(3);
  const navigate = useNavigate();

  const checkLockoutStatus = useCallback(async (emailAddr) => {
    try {
      const response = await axios.get('http://localhost:5000/api/auth/lockout-status', {
        params: { email: emailAddr }
      });
      setLocked(response.data.locked);
      if (response.data.locked) {
        setLockoutTime(response.data.remainingSeconds);
        setError(`Account temporarily locked. Try again in ${response.data.remainingSeconds}s`);
      } else {
        setAttemptsRemaining(response.data.attemptsRemaining);
        setError(prev => prev.includes('locked') ? '' : prev);
      }
    } catch (err) {
      console.error('Error checking lockout status:', err);
    }
  }, []);

  // Countdown timer for lockout
  useEffect(() => {
    if (locked && lockoutTime > 0) {
      const timer = setTimeout(() => {
        setLockoutTime(lockoutTime - 1);
        if (lockoutTime === 1) {
          setLocked(false);
          setError('');
          setAttemptsRemaining(3);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [locked, lockoutTime]);

  const handleEmailChange = (value) => {
    setEmail(value);
    setAttemptsRemaining(3);
    setLocked(false);
    setLockoutTime(0);
    setError(prev => prev.includes('locked') ? '' : prev);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (locked) {
      setError(`Account is locked. Please try again in ${lockoutTime} seconds.`);
      return;
    }

    setLoading(true);
    setError('');
    const loginEmail = normalizeLoginEmail(email);

    if (!loginEmail) {
      setError('Please enter your email.');
      setLoading(false);
      return;
    }
    
    try {
        const response = await axios.post('http://localhost:5000/api/auth/login', {
            email: loginEmail, password,
        });
        if (response.data) {
            localStorage.setItem('user', JSON.stringify({
                name: response.data.name,
                email: response.data.email,
                role: response.data.role,
                userId: response.data.userId,
                profileImage: response.data.profileImage,
                isOnline: response.data.isOnline,
                lastSeenAt: response.data.lastSeenAt,
            }));
            // Clear lockout on success
            setLocked(false);
            setAttemptsRemaining(3);
            navigate('/dashboard');
        }
    } catch (err) {
        const status = err.response?.status;
        const message = err.response?.data?.message;
        
        if (status === 423) {
          // Account locked
          setLocked(true);
          setLockoutTime(err.response.data.remainingSeconds);
          setAttemptsRemaining(0);
          setError(message);
        } else {
          // Invalid credentials
          if (Number.isFinite(err.response?.data?.attemptsRemaining)) {
            setAttemptsRemaining(err.response.data.attemptsRemaining);
          } else {
            await checkLockoutStatus(loginEmail);
          }
          setError(message || 'Invalid email or password. Please try again.');
        }
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="loginPageShell" style={{ display: 'flex', height: '100vh', fontFamily: 'Segoe UI, sans-serif' }}>

      {/* LEFT — Form */}
      <div className="loginFormPanel" style={{
        width: '50%',
        backgroundColor: '#FFFDF9',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px 90px',
      }}>

        {/* Brand name */}
        <div className="loginBrandBlock" style={{ marginBottom: '48px' }}>
          <h2 style={{
            fontSize: '28px',
            fontWeight: '800',
            color: '#8B5E3C',
            margin: 0,
            letterSpacing: '-0.5px',
          }}>
            FLUX
          </h2>
          <p style={{ fontSize: '14px', color: '#aaa', margin: '4px 0 0', fontWeight: '400' }}>
            Eli Coffee — Staff Portal
          </p>
        </div>

        {/* Heading */}
        <h1 className="loginTitle" style={{
          fontSize: '38px',
          fontWeight: '700',
          color: '#2a1a0e',
          margin: '0 0 8px',
          lineHeight: '1.2',
        }}>
          Welcome back!
        </h1>
        <p className="loginSubtitle" style={{ fontSize: '16px', color: '#999', margin: '0 0 40px' }}>
          Sign in to your account to continue.
        </p>

        {/* Error */}
        {error && (
          <div style={{
            backgroundColor: locked ? '#FEF2F2' : '#fff1f1',
            border: `1px solid ${locked ? '#FECACA' : '#fca5a5'}`,
            color: locked ? '#991B1B' : '#b91c1c',
            padding: '12px 14px',
            borderRadius: '8px',
            fontSize: '14px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}>
            <span>{error}</span>
            {!locked && attemptsRemaining > 0 && attemptsRemaining < 3 && (
              <span
                title={`${attemptsRemaining} attempt${attemptsRemaining !== 1 ? 's' : ''} remaining`}
                aria-label={`${attemptsRemaining} attempt${attemptsRemaining !== 1 ? 's' : ''} remaining`}
                style={{
                  minWidth: '38px',
                  height: '28px',
                  padding: '0 8px',
                  borderRadius: '999px',
                  backgroundColor: '#FFF7ED',
                  border: '1px solid #FDBA74',
                  color: '#C2410C',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  fontSize: '12px',
                  fontWeight: '900',
                  flexShrink: 0,
                }}
              >
                <FiAlertTriangle size={14} />
                {attemptsRemaining}
              </span>
            )}
          </div>
        )}

        <form onSubmit={handleLogin}>
          {/* Email */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#555',
              marginBottom: '8px',
            }}>
              Email
            </label>
            <div
              className="loginEmailInput"
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                border: '1.5px solid #e0d8d0',
                borderRadius: '8px',
                backgroundColor: locked ? '#f5f5f5' : '#fff',
                boxSizing: 'border-box',
                opacity: locked ? 0.6 : 1,
              }}
            >
              <input
                type="email"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                onBlur={() => {
                  const loginEmail = normalizeLoginEmail(email);
                  if (loginEmail) checkLockoutStatus(loginEmail);
                }}
                placeholder="admin@elicoffee.com"
                autoFocus
                required
                disabled={locked}
                autoComplete="email"
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '14px 10px 14px 16px',
                  border: 'none',
                  fontSize: '15px',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  color: '#2a1a0e',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: '12px', position: 'relative' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#555',
              marginBottom: '8px',
            }}>
              Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={locked}
              style={{
                width: '100%',
                padding: '14px 50px 14px 16px',
                border: '1.5px solid #e0d8d0',
                borderRadius: '8px',
                fontSize: '15px',
                outline: 'none',
                backgroundColor: locked ? '#f5f5f5' : '#fff',
                color: '#2a1a0e',
                boxSizing: 'border-box',
                opacity: locked ? 0.6 : 1,
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(prev => !prev)}
              disabled={locked}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute',
                right: '10px',
                bottom: '10px',
                width: '36px',
                height: '36px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                color: '#8B5E3C',
                cursor: locked ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
          </div>

          {/* Forgot Password Link */}
          <div style={{ textAlign: 'right', marginBottom: '24px' }}>
            <span 
              onClick={() => navigate('/forgot-password')}
              style={{
                fontSize: '13px',
                color: '#8B5E3C',
                fontWeight: '600',
                cursor: 'pointer',
                textDecoration: 'none'
              }}
              onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
              onMouseOut={(e) => e.target.style.textDecoration = 'none'}
            >
              Forgot password?
            </span>
          </div>

          {/* Button */}
          <button
            type="submit"
            disabled={loading || locked}
            style={{
              width: '100%',
              padding: '15px',
              backgroundColor: locked ? '#d1d5db' : loading ? '#c4a882' : '#8B5E3C',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: locked || loading ? 'not-allowed' : 'pointer',
            }}
          >
            {locked ? `Try again in ${lockoutTime}s` : loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="loginFooter" style={{ marginTop: '48px', fontSize: '13px', color: '#ccc' }}>
          © 2026 FLUX · Eli Coffee & Tea, Antipolo
        </p>
      </div>

      {/* RIGHT — Branding */}
      <div className="loginVisualPanel" style={{
        width: '50%',
        backgroundColor: '#3D1F0D',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
        padding: '40px',
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontSize: '42px',
            fontWeight: '800',
            color: '#F5EDE3',
            margin: '0 0 6px',
            letterSpacing: '-1px',
          }}>
            ELI COFFEE
          </h1>
          <p style={{
            fontSize: '13px',
            color: '#8B5E3C',
            letterSpacing: '5px',
            textTransform: 'uppercase',
            margin: 0,
            fontWeight: '500',
          }}>
            Antipolo
          </p>
        </div>

        <p style={{
          fontSize: '14px',
          color: 'rgba(245,237,227,0.35)',
          marginTop: '8px',
          textAlign: 'center',
          lineHeight: '1.6',
        }}>
          FLUX Point-of-Sale &<br />Inventory Management System
        </p>
      </div>

    </div>
  );
};

export default LoginPage;
