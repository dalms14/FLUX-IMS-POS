import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { clearSessionIfCurrent, getSessionCredentials, getSessionId, getSessionShift, getSessionUser, SESSION_CHANGED_EVENT } from '../utils/session';
import { isShiftExempt } from '../utils/shiftSchedule';
import './ShiftEndCountdown.css';

export default function ShiftEndCountdown() {
  const [remaining, setRemaining] = useState(null);
  useEffect(() => {
    const check = () => {
      const user = getSessionUser();
      const shift = getSessionShift();
      if (!user || isShiftExempt(user) || !shift) { setRemaining(null); return; }
      const now = Date.now() + shift.clockOffset;
      const ends = new Date(shift.shiftEndsAt).getTime();
      const deadline = new Date(shift.signOutAt).getTime();
      if (!Number.isFinite(ends) || !Number.isFinite(deadline) || now < ends) { setRemaining(null); return; }
      if (now >= deadline) {
        const id = getSessionId();
        const credentials = getSessionCredentials();
        // Capture the credential before clearing the browser session. The server
        // also rejects every protected request once the wrap-up deadline passes.
        axios.post('http://localhost:5000/api/auth/logout', { email: user.email }, { headers: {
          Authorization: `Bearer ${credentials.token}`,
        } }).catch(() => {});
        clearSessionIfCurrent(id);
        setRemaining(null);
        return;
      }
      setRemaining(Math.ceil((deadline - now) / 1000));
    };
    check();
    const timer = setInterval(check, 1000);
    window.addEventListener(SESSION_CHANGED_EVENT, check);
    window.addEventListener('storage', check);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      window.removeEventListener(SESSION_CHANGED_EVENT, check);
      window.removeEventListener('storage', check);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  if (remaining === null) return null;
  return <aside className="shift-end-countdown" aria-label="Shift ended">
    <div role="alert"><strong>Your shift has ended (Philippine time).</strong><p>Finish and save your work. You will be signed out automatically.</p></div>
    <span className="shift-end-clock" role="timer" aria-label="Time until automatic sign-out">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span>
  </aside>;
}
