import { useEffect, useState } from 'react';
import { getSessionUser, SESSION_CHANGED_EVENT } from './session';

const snapshot = () => getSessionUser() ? localStorage.getItem('user') : null;

export default function useSessionSync() {
  const [, refreshSession] = useState(snapshot);
  useEffect(() => {
    // Observing another tab must never erase the session it is writing.
    const checkSession = () => refreshSession(snapshot());
    const onStorage = event => {
      if (event.key === null || ['user', 'sessionExpiresAt'].includes(event.key)) checkSession();
    };
    checkSession();
    const timer = setInterval(checkSession, 1000);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', checkSession);
    window.addEventListener(SESSION_CHANGED_EVENT, checkSession);
    return () => {
      clearInterval(timer);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', checkSession);
      window.removeEventListener(SESSION_CHANGED_EVENT, checkSession);
    };
  }, []);
}
