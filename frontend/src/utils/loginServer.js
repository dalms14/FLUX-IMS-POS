import axios from 'axios';

const WAKE_TIMEOUT_MS = 120000;
const HEALTH_TIMEOUT_MS = 15000;
const RETRY_DELAY_MS = 1000;

export const needsLoginWarmup = () => typeof window !== 'undefined'
  && !['localhost', '127.0.0.1', '::1', '[::1]'].includes(window.location.hostname);

const unavailable = () => Object.assign(new Error('The sign-in server is still unavailable.'), {
  code: 'LOGIN_SERVER_UNAVAILABLE',
});

const pause = (ms, signal) => new Promise((resolve, reject) => {
  const cancel = () => {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
    reject(unavailable());
  };
  const timer = setTimeout(() => {
    signal?.removeEventListener('abort', cancel);
    resolve();
  }, ms);
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
});

// Retry only the read-only health check. A login POST must never be replayed:
// an ambiguous response could otherwise count another failed password attempt.
export async function waitForLoginServer(signal) {
  const deadline = Date.now() + WAKE_TIMEOUT_MS;
  while (!signal?.aborted) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      const response = await axios.get('http://localhost:5000/api/health', {
        timeout: Math.min(HEALTH_TIMEOUT_MS, remaining),
        signal,
      });
      if (!signal?.aborted && response.data?.status === 'ok') return;
    } catch {
      // A free host can return an error while its instance is starting.
    }
    if (signal?.aborted || Date.now() >= deadline) break;
    await pause(Math.min(RETRY_DELAY_MS, deadline - Date.now()), signal);
  }
  throw unavailable();
}
