import axios from 'axios';
import { clearSessionIfCurrent, getSessionId, getSessionUser, updateSessionShift } from './session';

export async function sendSessionHeartbeat() {
  const id = getSessionId();
  const user = getSessionUser();
  if (!id || !user) return;
  try {
    const response = await axios.post('http://localhost:5000/api/auth/heartbeat', { email: user.email });
    updateSessionShift(id, response?.data);
  } catch (err) {
    const inactive = err.response?.status === 403 && (
      ['ACCOUNT_INACTIVE', 'SHIFT_SESSION_ENDED'].includes(err.response.data?.code) ||
      err.response.data?.message === 'This account is no longer active. Please sign in with an active account.'
    );
    if (inactive) {
      // A delayed response for an old account must not end a newer login.
      clearSessionIfCurrent(id);
      return;
    }
    console.error('Error updating online status:', err);
  }
}
