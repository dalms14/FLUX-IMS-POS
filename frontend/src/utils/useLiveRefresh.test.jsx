import { act, cleanup, renderHook } from '@testing-library/react';
import useLiveRefresh from './useLiveRefresh';

beforeEach(() => jest.useFakeTimers());
afterEach(() => { cleanup(); jest.useRealTimers(); jest.restoreAllMocks(); });
const flush = () => act(async () => {});
const tick = () => act(async () => { jest.advanceTimersByTime(15000); });

test('polls visible pages, skips overlapping requests, pauses in background and removes timers on unmount', async () => {
    const load = jest.fn().mockResolvedValue(1);
    const apply = jest.fn();
    const visibility = jest.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const { result, unmount } = renderHook(() => useLiveRefresh(load, apply));
    await flush();
    expect(apply).toHaveBeenLastCalledWith(1);
    let finish;
    load.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await tick();
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(true);
    await tick();
    expect(load).toHaveBeenCalledTimes(2);
    await act(async () => finish(2));
    visibility.mockReturnValue(true);
    await tick();
    expect(load).toHaveBeenCalledTimes(2);
    visibility.mockReturnValue(false);
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(load).toHaveBeenCalledTimes(3);
    unmount(); await tick();
    expect(load).toHaveBeenCalledTimes(3);
});

test('changing filters or opening a form aborts old requests and prevents stale results', async () => {
    let finish;
    let signal;
    const oldLoad = jest.fn(s => { signal = s; return new Promise(resolve => { finish = resolve; }); });
    const nextLoad = jest.fn().mockResolvedValue('current');
    const apply = jest.fn();
    const { rerender } = renderHook(({ load, paused }) => useLiveRefresh(load, apply, { paused }), { initialProps: { load: oldLoad, paused: false } });
    rerender({ load: nextLoad, paused: true });
    expect(signal.aborted).toBe(true);
    await act(async () => finish('old'));
    expect(apply).not.toHaveBeenCalled();
    await tick(); expect(nextLoad).not.toHaveBeenCalled();
    rerender({ load: nextLoad, paused: false });
    await flush(); expect(apply).toHaveBeenLastCalledWith('current');
});

test('keeps successful data on failure, retries automatically, and reconnects without making activity writes', async () => {
    const load = jest.fn().mockResolvedValue(10);
    const apply = jest.fn();
    const online = jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    localStorage.setItem('user', 'unchanged-session');
    const { result } = renderHook(() => useLiveRefresh(load, apply));
    await flush();
    const updated = result.current.lastUpdated;
    load.mockRejectedValueOnce(new Error('Network down'));
    await tick();
    expect(result.current.error).toMatch(/outdated/);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(result.current.lastUpdated).toBe(updated);
    online.mockReturnValue(false);
    await act(async () => window.dispatchEvent(new Event('offline')));
    await tick(); expect(load).toHaveBeenCalledTimes(2);
    online.mockReturnValue(true);
    await act(async () => window.dispatchEvent(new Event('online')));
    expect(result.current.error).toBe('');
    expect(apply).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem('user')).toBe('unchanged-session');
});
