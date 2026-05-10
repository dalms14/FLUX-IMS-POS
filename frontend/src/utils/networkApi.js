import axios from 'axios';

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

axios.interceptors.request.use(config => {
  if (typeof config.url === 'string' && config.url.startsWith(LOCAL_API_ORIGIN)) {
    config.url = config.url.replace(LOCAL_API_ORIGIN, API_ORIGIN);
  }

  return config;
});

if (typeof window !== 'undefined' && window.fetch) {
  const originalFetch = window.fetch.bind(window);

  window.fetch = (resource, options) => {
    if (typeof resource === 'string' && resource.startsWith(LOCAL_API_ORIGIN)) {
      return originalFetch(resource.replace(LOCAL_API_ORIGIN, API_ORIGIN), options);
    }

    if (resource instanceof Request && resource.url.startsWith(LOCAL_API_ORIGIN)) {
      const nextRequest = new Request(resource.url.replace(LOCAL_API_ORIGIN, API_ORIGIN), resource);
      return originalFetch(nextRequest, options);
    }

    return originalFetch(resource, options);
  };
}

export { API_ORIGIN };
