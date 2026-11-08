import axios from 'axios';
import { needsLoginWarmup, waitForLoginServer } from './loginServer';

jest.mock('axios');
beforeEach(() => { jest.resetAllMocks(); jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
const flushPromises = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); };

test('local development does not need a hosted-server warmup', () => {
  expect(needsLoginWarmup()).toBe(false);
});

test('a transient startup failure retries the health check until the server is ready', async () => {
  axios.get.mockRejectedValueOnce(new Error('starting')).mockResolvedValueOnce({ data: { status: 'ok' } });
  const ready = waitForLoginServer();
  await flushPromises();
  expect(jest.getTimerCount()).toBe(1);
  jest.advanceTimersByTime(1000);
  await flushPromises();
  await ready;
  expect(axios.get).toHaveBeenCalledTimes(2);
  expect(axios.get).toHaveBeenLastCalledWith('http://localhost:5000/api/health', expect.objectContaining({ timeout: 15000 }));
  expect(axios.post).not.toHaveBeenCalled();
});

test('a health response containing an HTML loading page is not accepted as readiness', async () => {
  axios.get.mockResolvedValueOnce({ data: '<html>Loading</html>' }).mockResolvedValueOnce({ data: { status: 'ok' } });
  const ready = waitForLoginServer();
  await flushPromises();
  expect(jest.getTimerCount()).toBe(1);
  jest.advanceTimersByTime(1000);
  await flushPromises();
  await ready;
  expect(axios.get).toHaveBeenCalledTimes(2);
});

test('the startup wait ends at its two-minute deadline', async () => {
  jest.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(120000);
  axios.get.mockRejectedValue(new Error('unavailable'));
  await expect(waitForLoginServer()).rejects.toMatchObject({ code: 'LOGIN_SERVER_UNAVAILABLE' });
  expect(axios.get).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

test('cancelling during a retry delay stops further requests and clears the timer', async () => {
  const controller = new AbortController();
  axios.get.mockRejectedValue(new Error('starting'));
  const ready = waitForLoginServer(controller.signal);
  const rejected = expect(ready).rejects.toMatchObject({ code: 'LOGIN_SERVER_UNAVAILABLE' });
  await flushPromises();
  controller.abort();
  await rejected;
  jest.advanceTimersByTime(1000);
  expect(axios.get).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});
