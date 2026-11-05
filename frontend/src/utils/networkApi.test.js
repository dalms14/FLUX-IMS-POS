import axios from 'axios';
import { getSessionUser, startSession } from './session';
jest.mock('axios', () => ({ interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } } }));

// A small Headers substitute supplies the browser interface in Jest's jsdom.
class TestHeaders {
  constructor(initial) { this.values = new Map(); if (initial?.forEach) initial.forEach((v, k) => this.set(k, v)); else Object.entries(initial || {}).forEach(([k, v]) => this.set(k, v)); }
  set(key, value) { this.values.set(key.toLowerCase(), value); }
  get(key) { return this.values.get(key.toLowerCase()); }
  forEach(callback) { this.values.forEach(callback); }
}
const fetchRequest = jest.fn();
window.fetch = fetchRequest;
global.Headers = TestHeaders;
require('./networkApi');
const onRequest = axios.interceptors.request.use.mock.calls[0][0];
const onRejection = axios.interceptors.response.use.mock.calls[0][1];
const account = { name: 'Staff', role: 'staff', email: 'staff@example.com', sessionToken: 'a'.repeat(64) };
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); fetchRequest.mockReset(); startSession(account); });

test('Axios and fetch attach the server-issued credential and shared activity only to the API', async () => {
  const config = onRequest({ url: 'http://localhost:5000/api/products', headers: {} });
  expect(config.headers.Authorization).toBe(`Bearer ${account.sessionToken}`);
  expect(Number(config.headers['X-Session-Activity'])).toBeGreaterThan(0);
  fetchRequest.mockResolvedValue({ status: 200 });
  await window.fetch('http://localhost:5000/api/auth/profile-picture', { method: 'PUT' });
  expect(fetchRequest.mock.calls[0][1].headers.get('authorization')).toBe(`Bearer ${account.sessionToken}`);
  for (const url of ['https://example.com/api/products', 'http://localhost:5000.evil.example/api/products']) {
    expect(onRequest({ url, headers: {} }).headers.Authorization).toBeUndefined();
    await window.fetch(url);
    expect(fetchRequest.mock.calls[fetchRequest.mock.calls.length - 1][1]).toBeUndefined();
  }
});

test('an old request rejection cannot clear a newer login for the same account', async () => {
  const config = onRequest({ url: 'http://localhost:5000/api/products', headers: {} });
  startSession({ ...account, sessionToken: 'b'.repeat(64) });
  await expect(onRejection({ config, response: { status: 401, data: { code: 'SESSION_EXPIRED' } } })).rejects.toBeDefined();
  expect(getSessionUser().email).toBe(account.email);
});

test('wrong password confirmation leaves the login intact; an expired current session signs out', async () => {
  const config = onRequest({ url: 'http://localhost:5000/api/system/backup', headers: {} });
  await expect(onRejection({ config, response: { status: 403, data: { message: 'Password confirmation failed' } } })).rejects.toBeDefined();
  expect(getSessionUser()).not.toBeNull();
  await expect(onRejection({ config, response: { status: 401, data: { code: 'SESSION_EXPIRED' } } })).rejects.toBeDefined();
  expect(getSessionUser()).toBeNull();
});
