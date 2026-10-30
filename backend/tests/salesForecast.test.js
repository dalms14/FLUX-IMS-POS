const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Transaction = require('../models/Transaction');
const ForecastSnapshot = require('../models/ForecastSnapshot');
ForecastSnapshot.updateOne = async () => ({});
ForecastSnapshot.find = () => ({ sort: () => ({ lean: async () => [] }) });
const { addDays, businessDate, validDate, demoHistory, createForecast, MIN_HISTORY_DAYS } = require('../services/salesForecast');
const router = require('../Routes/salesForecastRoutes');
const { trainLinearSalesModel, predictLinearSales, predictWeekdayAverage, evaluateSalesModel } = require('../services/linearSalesModel');
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
    assert.equal(result.model.name, 'Linear regression');
    assert.equal(result.model.trainingRows, 56);
    assert.equal(result.validation.days, 14);
    for (const fold of result.validation.folds) assert.ok(fold.trainedThrough < fold.testedFrom);
    for (const row of result.forecast) {
        assert.ok(Number.isFinite(row.sales));
        assert.ok(row.sales >= 0);
    }
});

test('learns a known daily trend and weekday differences from examples', () => {
    const weekday = date => new Date(`${date}T00:00:00Z`).getUTCDay();
    const history = Array.from({ length: 56 }, (_, i) => {
        const date = addDays(today, i - 56);
        return { date, sales: 3000 + i * 20 + weekday(date) * 100 };
    });
    const result = createForecast(history, { today, source: 'real' });
    assert.ok(Math.abs(result.model.trend - 20) < 1e-8);
    result.forecast.forEach((row, index) => assert.equal(row.sales, 3000 + (56 + index) * 20 + weekday(row.date) * 100));
    assert.equal(result.validation.modelMae, 0);
    assert.ok(result.validation.baselineMae > 0);
    const faster = trainLinearSalesModel(history.map((row, i) => ({ ...row, sales: row.sales + i * 20 })));
    assert.ok(Math.abs(faster.trend - 40) < 1e-8);
});

test('ignores older records and predicts zero for a confirmed future closure', () => {
    const history = Array.from({ length: 112 }, (_, i) => ({ date: addDays(today, i - 112), sales: i < 28 ? 9000 : 5000 }));
    const result = createForecast(history, { today, source: 'real', isClosed: date => date === addDays(today, 2) });
    assert.equal(result.historyDays, 84);
    assert.equal(result.forecast[0].sales, 5000);
    assert.deepEqual(result.forecast[2], { date: addDays(today, 2), sales: 0, closed: true });
});

test('refuses short, invalid, missing, or stale history', () => {
    const short = createForecast(demoHistory(today).slice(-20), { today, source: 'real' });
    assert.equal(short.status, 'insufficient-history');
    assert.equal(short.minimumHistoryDays, MIN_HISTORY_DAYS);
    const history = Array.from({ length: 56 }, (_, i) => ({ date: addDays(today, i - 56), sales: 5000 }));
    assert.throws(() => createForecast(history.slice(0, -1), { today, source: 'real' }), /last completed/);
    assert.throws(() => createForecast(history.filter((_, i) => i !== 10), { today, source: 'real' }), /consecutive/);
    assert.throws(() => createForecast(history.map((row, i) => i === 10 ? { ...row, sales: NaN } : row), { today, source: 'real' }), /finite/);
});

test('keeps the original four-week weekday average as the comparison method', () => {
    const history = Array.from({ length: 56 }, (_, i) => ({ date: addDays(today, i - 56), sales: i < 28 ? 9000 : (Math.floor((i - 28) / 7) + 1) * 1000 }));
    assert.equal(predictWeekdayAverage(history, today), 2500);
});

test('held-out sales do not leak into the first validation week', () => {
    const history = Array.from({ length: 56 }, (_, i) => ({ date: addDays(today, i - 56), sales: i < 42 ? 3000 : 10000 }));
    const result = evaluateSalesModel(history);
    assert.equal(result.folds[0].modelMae, 7000);
    assert.equal(result.folds[0].baselineMae, 7000);
    assert.equal(result.folds[0].trainedThrough, addDays(today, -15));
    assert.equal(result.folds[0].testedFrom, addDays(today, -14));
    assert.equal(result.folds[1].trainedThrough, addDays(today, -8));
});

test('reports when the baseline predicts a flattening trend better than regression', () => {
    const history = Array.from({ length: 84 }, (_, i) => ({ date: addDays(today, i - 84), sales: i < 56 ? 1000 + i * 100 : 6500 }));
    const result = createForecast(history, { today, source: 'demo' });
    assert.equal(result.model.name, 'Linear regression');
    assert.ok(result.validation.baselineMae < result.validation.modelMae);
    assert.equal(result.validation.baselineIsBetter, true);
});

test('zero sales and negative extrapolations produce safe nonnegative estimates', () => {
    const zeros = Array.from({ length: 56 }, (_, i) => ({ date: addDays(today, i - 56), sales: 0 }));
    const result = createForecast(zeros, { today, source: 'demo' });
    assert.equal(result.total, 0);
    assert.equal(result.validation.modelMae, 0);
    const decline = zeros.map((row, i) => ({ ...row, sales: 5500 - i * 100 }));
    assert.equal(predictLinearSales(trainLinearSalesModel(decline), today), 0);
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
        assert.ok([-60, -30].some(offset => filter.createdAt.$gte.toISOString() === new Date(`${addDays(currentDay, offset)}T00:00:00+08:00`).toISOString()));
        assert.equal(filter.createdAt.$lt.toISOString(), new Date(`${currentDay}T00:00:00+08:00`).toISOString());
        assert.equal(pipeline[1].$group._id.$dateToString.timezone, 'Asia/Manila');
        return Array.from({ length: 60 }, (_, i) => ({ _id: addDays(currentDay, i - 60), sales: 5000 + i * 10 }));
    };
    const result = await invoke('real');
    assert.equal(result.status, 200);
    assert.equal(result.data.status, 'ready');
    assert.equal(result.data.source, 'real');
    assert.equal(result.data.historyDays, 60);
});

test('missing sales days block a real forecast instead of becoming invented zero-sales days', async () => {
    const currentDay = businessDate();
    process.env.FORECAST_REAL_SALES_START_DATE = addDays(currentDay, -61);
    delete process.env.FORECAST_CLOSED_WEEKDAYS;
    delete process.env.FORECAST_CLOSED_DATES;
    Transaction.aggregate = async () => [];
    const result = await invoke('real');
    assert.equal(result.data.status, 'incomplete-history');
    assert.equal(result.data.missingDays, 61);
    assert.equal(result.data.forecast, undefined);
});
