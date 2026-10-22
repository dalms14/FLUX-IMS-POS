const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Transaction = require('../models/Transaction');
const { addDays, businessDate, validDate, demoHistory, createForecast, MIN_HISTORY_DAYS } = require('../services/salesForecast');
const router = require('../Routes/salesForecastRoutes');
const today = '2026-10-23';

test('uses the Philippine business date across the UTC midnight boundary', () => {
    assert.equal(businessDate(new Date('2026-10-22T15:59:59Z')), '2026-10-22');
    assert.equal(businessDate(new Date('2026-10-22T16:00:00Z')), '2026-10-23');
    assert.equal(validDate('2026-02-30'), false);
    assert.equal(validDate('2028-02-29'), true);
});

test('demo forecasts are deterministic, finite, seven days long, and explicitly labeled', () => {
    const result = createForecast(demoHistory(today), { today, source: 'demo' });
    assert.deepEqual(result, createForecast(demoHistory(today), { today, source: 'demo' }));
    assert.equal(result.source, 'demo');
    assert.equal(result.forecast.length, 7);
    assert.equal(result.forecast[0].date, today);
    assert.equal(result.forecast[6].date, addDays(today, 6));
    assert.equal(result.trainedThrough, addDays(today, -1));
    assert.equal(result.tomorrow, result.forecast[1].sales);
    for (const row of result.forecast) {
        assert.ok(Number.isFinite(row.sales));
        assert.ok(row.sales >= 0);
    }
});

test('uses the average of the four previous matching weekdays', () => {
    const history = demoHistory(today).map((row, index) => ({ ...row, sales: (Math.floor(index / 7) + 1) * 1000 }));
    const result = createForecast(history, { today, source: 'real' });
    result.forecast.forEach(row => assert.equal(row.sales, 2500));
    assert.equal(result.total, 17500);
    assert.equal(result.tomorrow, 2500);
});

test('ignores older records and predicts zero for a confirmed future closure', () => {
    const history = Array.from({ length: 56 }, (_, i) => ({ date: addDays(today, i - 56), sales: i < 28 ? 9000 : 5000 }));
    const result = createForecast(history, { today, source: 'real', isClosed: date => date === addDays(today, 2) });
    assert.equal(result.historyDays, 28);
    assert.equal(result.forecast[0].sales, 5000);
    assert.deepEqual(result.forecast[2], { date: addDays(today, 2), sales: 0, closed: true });
});

test('refuses short, invalid, missing, or stale history', () => {
    const short = createForecast(demoHistory(today).slice(-20), { today, source: 'real' });
    assert.equal(short.status, 'insufficient-history');
    assert.equal(short.minimumHistoryDays, MIN_HISTORY_DAYS);
    const history = Array.from({ length: 35 }, (_, i) => ({ date: addDays(today, i - 35), sales: 5000 }));
    assert.throws(() => createForecast(history.slice(0, -1), { today, source: 'real' }), /last completed/);
    assert.throws(() => createForecast(history.filter((_, i) => i !== 10), { today, source: 'real' }), /consecutive/);
    assert.throws(() => createForecast(history.map((row, i) => i === 10 ? { ...row, sales: NaN } : row), { today, source: 'real' }), /finite/);
});

const originalAggregate = Transaction.aggregate;
const envKeys = ['FORECAST_REAL_SALES_START_DATE', 'FORECAST_CLOSED_WEEKDAYS', 'FORECAST_CLOSED_DATES'];
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
afterEach(() => {
    Transaction.aggregate = originalAggregate;
    for (const key of envKeys) {
        if (originalEnv[key] === undefined) delete process.env[key];
        else process.env[key] = originalEnv[key];
    }
});
const invoke = async source => {
    let status = 200;
    let data;
    await router.stack[0].route.stack[0].handle({ query: { source } }, { status(code) { status = code; return this; }, json(value) { data = value; return this; } });
    return { status, data };
};

test('demo and unconfigured real mode never read test transactions from the database', async () => {
    delete process.env.FORECAST_REAL_SALES_START_DATE;
    Transaction.aggregate = () => { throw new Error('Database must not be read'); };
    assert.equal((await invoke('demo')).data.source, 'demo');
    assert.equal((await invoke('real')).data.status, 'awaiting-real-sales');
    assert.equal((await invoke('unknown')).status, 400);
});

test('real mode queries only completed sales after the verified start and excludes today', async () => {
    const currentDay = businessDate();
    process.env.FORECAST_REAL_SALES_START_DATE = addDays(currentDay, -60);
    delete process.env.FORECAST_CLOSED_WEEKDAYS;
    delete process.env.FORECAST_CLOSED_DATES;
    Transaction.aggregate = async pipeline => {
        const filter = pipeline[0].$match;
        assert.equal(filter.orderStatus, 'completed');
        assert.equal(filter.paymentMethod.$ne, 'Cancelled');
        assert.equal(filter.createdAt.$gte.toISOString(), new Date(`${addDays(currentDay, -28)}T00:00:00+08:00`).toISOString());
        assert.equal(filter.createdAt.$lt.toISOString(), new Date(`${currentDay}T00:00:00+08:00`).toISOString());
        assert.equal(pipeline[1].$group._id.$dateToString.timezone, 'Asia/Manila');
        return demoHistory(currentDay).slice(-60).map(row => ({ _id: row.date, sales: row.sales }));
    };
    const result = await invoke('real');
    assert.equal(result.status, 200);
    assert.equal(result.data.status, 'ready');
    assert.equal(result.data.source, 'real');
    assert.equal(result.data.historyDays, 28);
});

test('missing sales days block a real forecast instead of becoming invented zero-sales days', async () => {
    const currentDay = businessDate();
    process.env.FORECAST_REAL_SALES_START_DATE = addDays(currentDay, -61);
    delete process.env.FORECAST_CLOSED_WEEKDAYS;
    delete process.env.FORECAST_CLOSED_DATES;
    Transaction.aggregate = async () => [];
    const result = await invoke('real');
    assert.equal(result.data.status, 'incomplete-history');
    assert.equal(result.data.missingDays, 28);
    assert.equal(result.data.forecast, undefined);
});
