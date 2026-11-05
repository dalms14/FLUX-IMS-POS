import axios from 'axios';
import { clearSessionIfCurrent, getSessionCredentials } from './session';

const LOCAL_API_ORIGIN = 'http://localhost:5000';

const getApiOrigin = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL.replace(/\/$/, '');
  }

  if (typeof window === 'undefined') {
    return LOCAL_API_ORIGIN;
  }

  const { protocol, hostname } = window.location;
  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);

  if (localHosts.has(hostname)) {
    return LOCAL_API_ORIGIN;
  }

  return `${protocol}//${hostname}:5000`;
};

const API_ORIGIN = getApiOrigin();

const resolveApiRequest = raw => {
  try {
    const url = new URL(raw, typeof window === 'undefined' ? LOCAL_API_ORIGIN : window.location.href);
    if (url.origin === LOCAL_API_ORIGIN && /^\/api(?:\/|$)/.test(url.pathname)) return `${API_ORIGIN}${url.pathname}${url.search}`;
    return url.href;
  } catch { return raw; }
};
const isApiRequest = raw => {
  try {
    const base = new URL(API_ORIGIN);
    const url = new URL(raw);
    return url.origin === base.origin && url.pathname.startsWith(`${base.pathname.replace(/\/$/, '')}/api/`);
  } catch { return false; }
};
const sessionHeaders = credentials => credentials?.token ? {
  Authorization: `Bearer ${credentials.token}`,
  'X-Session-Activity': String(credentials.lastActiveAt),
} : {};
const endRejectedSession = (status, payload, id) => {
  if ([401, 403].includes(status) && ['AUTH_REQUIRED', 'SESSION_EXPIRED', 'ACCOUNT_INACTIVE'].includes(payload?.code)) clearSessionIfCurrent(id);
};

axios.interceptors.request.use(config => {
  if (typeof config.url === 'string') config.url = resolveApiRequest(config.url);
  if (isApiRequest(config.url)) {
    const credentials = getSessionCredentials();
    config.headers = { ...config.headers, ...sessionHeaders(credentials) };
    config.fluxSessionId = credentials?.id;
  }
  return config;
});
axios.interceptors.response.use(response => response, error => {
  if (error.config?.fluxSessionId) endRejectedSession(error.response?.status, error.response?.data, error.config.fluxSessionId);
  return Promise.reject(error);
});

if (typeof window !== 'undefined' && window.fetch) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (resource, options) => {
    const isRequest = typeof Request !== 'undefined' && resource instanceof Request;
    const url = resolveApiRequest(isRequest ? resource.url : resource);
    if (!isApiRequest(url)) return originalFetch(resource, options);
    const credentials = getSessionCredentials();
    const headers = new Headers(isRequest ? resource.headers : undefined);
    new Headers(options?.headers).forEach((value, key) => headers.set(key, value));
    Object.entries(sessionHeaders(credentials)).forEach(([key, value]) => headers.set(key, value));
    const request = isRequest ? new Request(url, resource) : url;
    const response = await originalFetch(request, { ...options, headers });
    if ([401, 403].includes(response.status)) {
      try { endRejectedSession(response.status, await response.clone().json(), credentials?.id); } catch { /* Non-JSON failures do not revoke a session. */ }
    }
    return response;
  };
}

export { API_ORIGIN };
