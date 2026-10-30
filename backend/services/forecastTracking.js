const ForecastSnapshot = require('../models/ForecastSnapshot');
const Transaction = require('../models/Transaction');
const { addDays, businessDate, demoHistory } = require('./salesForecast');
const round = n => Math.round(n * 100) / 100;

function compareSnapshots(snapshots, totals, { today, isClosed }) {
    const rows = snapshots.map(snapshot => {
        // Reject backdated or same-day predictions, even if an invalid record exists.
        const eligible = businessDate(new Date(snapshot.generatedAt)) < snapshot.targetDate && snapshot.trainedThrough < snapshot.targetDate;
        const complete = eligible && snapshot.targetDate < today;
        const actual = complete && totals.has(snapshot.targetDate) ? totals.get(snapshot.targetDate)
            : complete && isClosed(snapshot.targetDate) ? 0 : null;
        return { date: snapshot.targetDate, predicted: snapshot.predictedSales,
            generatedAt: snapshot.generatedAt, actual,
            error: actual === null ? null : round(Math.abs(actual - snapshot.predictedSales)),
            status: actual !== null ? 'compared' : complete ? 'missing-sales' : 'waiting' };
    });
    const compared = rows.filter(row => row.error !== null);
    return { rows, comparedDays: compared.length,
        mae: compared.length ? round(compared.reduce((sum, row) => sum + row.error, 0) / compared.length) : null };
}

async function trackForecast(data, { today, start, isClosed, now = new Date() }) {
    const dataset = data.source === 'demo' ? 'demo-v2-calendar' : `real:${start}`;
    // Tomorrow onward only. Never save today's estimate as a pre-day forecast.
    for (const row of data.forecast.filter(row => row.date > today)) {
        try {
            await ForecastSnapshot.updateOne({ dataset, targetDate: row.date }, { $setOnInsert: {
                dataset, source: data.source, targetDate: row.date, predictedSales: row.sales,
                generatedAt: now, trainedThrough: data.trainedThrough, method: data.method,
            } }, { upsert: true });
        } catch (err) { if (err.code !== 11000) throw err; }
    }
    const snapshots = await ForecastSnapshot.find({ dataset, targetDate: { $gte: addDays(today, -30) } })
        .sort({ targetDate: -1 }).lean();
    const totals = new Map();
    if (data.source === 'demo') {
        for (const row of snapshots) {
            if (row.targetDate < today) totals.set(row.targetDate, demoHistory(addDays(row.targetDate, 1)).at(-1).sales);
        }
    } else {
        const first = addDays(today, -30) > start ? addDays(today, -30) : start;
        const actuals = await Transaction.aggregate([
            { $match: { orderStatus: 'completed', paymentMethod: { $ne: 'Cancelled' }, createdAt: {
                $gte: new Date(`${first}T00:00:00+08:00`), $lt: new Date(`${today}T00:00:00+08:00`),
            } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Manila' } }, sales: { $sum: '$total' } } },
        ]);
        actuals.forEach(row => totals.set(row._id, row.sales));
    }
    return { source: data.source, ...compareSnapshots(snapshots, totals, { today, isClosed }) };
}
module.exports = { compareSnapshots, trackForecast };
