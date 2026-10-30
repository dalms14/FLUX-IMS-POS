const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Snapshot = require('../models/ForecastSnapshot');
const Transaction = require('../models/Transaction');
const { compareSnapshots, trackForecast } = require('../services/forecastTracking');
const { demoHistory } = require('../services/salesForecast');
const originals = { updateOne: Snapshot.updateOne, find: Snapshot.find, aggregate: Transaction.aggregate };
afterEach(() => { Snapshot.updateOne = originals.updateOne; Snapshot.find = originals.find; Transaction.aggregate = originals.aggregate; });
const record = (targetDate, predictedSales = 5000) => ({ targetDate, predictedSales,
    generatedAt: new Date('2026-10-20T03:00:00Z'), trainedThrough: '2026-10-19' });

test('compares only completed dates, preserves unknown days, includes verified zero-sales closures', () => {
    const result = compareSnapshots([record('2026-10-21'), record('2026-10-22'), record('2026-10-23'), record('2026-10-24')],
        new Map([['2026-10-21', 4700]]), { today: '2026-10-24', isClosed: date => date === '2026-10-22' });
    assert.equal(result.rows[0].error, 300);
    assert.equal(result.rows[1].actual, 0);
    assert.equal(result.rows[2].actual, null);
    assert.equal(result.rows[2].status, 'missing-sales');
    assert.equal(result.rows[3].status, 'waiting');
    assert.equal(result.comparedDays, 2);
    assert.equal(result.mae, 2650);
});

test('rejects same-day predictions using Philippine time and never claims empty accuracy', () => {
    const snapshot = { ...record('2026-10-21'), generatedAt: new Date('2026-10-20T16:00:00Z') };
    const result = compareSnapshots([snapshot], new Map([['2026-10-21', 5000]]), { today: '2026-10-22', isClosed: () => false });
    assert.equal(result.mae, null);
    assert.equal(result.comparedDays, 0);
});

test('upserts future dates without overwriting first prediction, and isolates demo from transactions', async () => {
    const saved = new Map();
    Snapshot.updateOne = async (key, update, options) => {
        assert.equal(options.upsert, true);
        assert.deepEqual(Object.keys(update), ['$setOnInsert']);
        if (!saved.has(key.targetDate)) saved.set(key.targetDate, update.$setOnInsert);
    };
    Snapshot.find = filter => {
        assert.equal(filter.dataset, 'demo-v2-calendar');
        return { sort: () => ({ lean: async () => [...saved.values()] }) };
    };
    Transaction.aggregate = () => { throw new Error('Demo must never query real transactions'); };
    const data = { source: 'demo', trainedThrough: '2026-10-19', forecast: [{ date: '2026-10-20', sales: 5 }, { date: '2026-10-21', sales: 5000 }] };
    const options = { today: '2026-10-20', now: new Date('2026-10-20T03:00:00Z'), isClosed: () => false };
    await trackForecast(data, options);
    data.forecast[1].sales = 9999;
    await trackForecast(data, options);
    assert.equal(saved.size, 1);
    assert.equal(saved.get('2026-10-21').predictedSales, 5000);
});

test('demo sales stay identical across overlapping calendar windows', () => {
    const first = demoHistory('2026-10-23').find(row => row.date === '2026-10-20');
    const second = demoHistory('2026-10-24').find(row => row.date === '2026-10-20');
    assert.deepEqual(first, second);
});

test('real tracking isolates the handover dataset and queries only completed past client sales', async () => {
    Snapshot.updateOne = async () => { const err = new Error('Concurrent insert'); err.code = 11000; throw err; };
    Snapshot.find = filter => {
        assert.equal(filter.dataset, 'real:2026-10-01');
        return { sort: () => ({ lean: async () => [record('2026-10-21')] }) };
    };
    Transaction.aggregate = async pipeline => {
        const match = pipeline[0].$match;
        assert.equal(match.orderStatus, 'completed');
        assert.equal(match.paymentMethod.$ne, 'Cancelled');
        assert.equal(match.createdAt.$gte.toISOString(), '2026-09-30T16:00:00.000Z');
        assert.equal(match.createdAt.$lt.toISOString(), '2026-10-22T16:00:00.000Z');
        return [{ _id: '2026-10-21', sales: 4700 }];
    };
    const result = await trackForecast({ source: 'real', trainedThrough: '2026-10-22', forecast: [{ date: '2026-10-24', sales: 5200 }] },
        { today: '2026-10-23', start: '2026-10-01', isClosed: () => false });
    assert.equal(result.mae, 300);
    assert.equal(result.source, 'real');
});
