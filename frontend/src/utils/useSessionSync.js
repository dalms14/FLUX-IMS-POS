import { useEffect, useState } from 'react';
import { getSessionUser, recordSessionActivity, SESSION_CHANGED_EVENT } from './session';

const snapshot = () => JSON.stringify(getSessionUser());

export default function useSessionSync() {
  const [, refreshSession] = useState(snapshot);
  useEffect(() => {
    // Observing another tab must never erase the session it is writing.
    const checkSession = () => refreshSession(snapshot());
    const onStorage = event => {
      if (event.key === null || ['user', 'sessionExpiresAt'].includes(event.key)) checkSession();
    };
    const onActivity = () => {
      if (!document.hidden) recordSessionActivity();
      checkSession();
    };
    const onVisibility = () => { if (!document.hidden) checkSession(); };
    const activityEvents = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'];
    checkSession();
    const timer = setInterval(checkSession, 1000);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', checkSession);
    window.addEventListener(SESSION_CHANGED_EVENT, checkSession);
    document.addEventListener('visibilitychange', onVisibility);
    activityEvents.forEach(event => window.addEventListener(event, onActivity, { passive: true, capture: true }));
    return () => {
      clearInterval(timer);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', checkSession);
      window.removeEventListener(SESSION_CHANGED_EVENT, checkSession);
      document.removeEventListener('visibilitychange', onVisibility);
      activityEvents.forEach(event => window.removeEventListener(event, onActivity, true));
    };
  }, []);
}
