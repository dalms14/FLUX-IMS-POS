import axios from 'axios';
import { sendSessionHeartbeat } from './sessionHeartbeat';
import { getSessionUser, startSession } from './session';

jest.mock('axios');
const user = { email: 'staff@example.com', role: 'staff' };
const inactive = { response: { status: 403, data: { code: 'ACCOUNT_INACTIVE' } } };
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  jest.resetAllMocks();
});
afterEach(() => jest.restoreAllMocks());

test('a late rejection for an old account cannot end a new login', async () => {
  let reject;
  axios.post.mockImplementation(() => new Promise((resolve, rejectRequest) => { reject = rejectRequest; }));
  startSession(user);
  const request = sendSessionHeartbeat();
  const newUser = { email: 'other@example.com', role: 'staff' };
  startSession(newUser);
  reject(inactive);
  await request;
  expect(getSessionUser()).toEqual(newUser);
});

test('a late rejection cannot end a newer login for the same email', async () => {
  let reject;
  axios.post.mockImplementation(() => new Promise((resolve, rejectRequest) => { reject = rejectRequest; }));
  startSession(user);
  const request = sendSessionHeartbeat();
  startSession(user);
  reject(inactive);
  await request;
  expect(getSessionUser()).toEqual(user);
});

test('an inactive-account response ends the matching current session', async () => {
  startSession(user);
  axios.post.mockRejectedValue(inactive);
  await sendSessionHeartbeat();
  expect(getSessionUser()).toBeNull();
});

test.each([404, 500, 403])('a generic HTTP %s does not erase a remembered login', async status => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  startSession(user);
  axios.post.mockRejectedValue({ response: { status, data: {} } });
  await sendSessionHeartbeat();
  expect(getSessionUser()).toEqual(user);
});

test('does not send a heartbeat while logged out', async () => {
  await sendSessionHeartbeat();
  expect(axios.post).not.toHaveBeenCalled();
});
