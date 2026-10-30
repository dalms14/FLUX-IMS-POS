const DAY_MS = 86400000;
const { trainLinearSalesModel, predictLinearSales, evaluateSalesModel } = require('./linearSalesModel');
const MIN_HISTORY_DAYS = 42; // Four weeks to train the first test, then two held-out weeks.
const MAX_HISTORY_DAYS = 84;
const round = value => Math.round(value * 100) / 100;
const weekday = date => new Date(`${date}T00:00:00Z`).getUTCDay();
const addDays = (date, days) => new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
const businessDate = (now = new Date()) => new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && addDays(value, 0) === value;

// Fixed synthetic history is generated in memory, never inserted into the POS database.
function demoHistory(today) {
    const dailySales = [5800, 4000, 4300, 4500, 4800, 6200, 7000];
    return Array.from({ length: 56 }, (_, index) => {
        const date = addDays(today, index - 56);
        // Anchor samples to calendar dates so yesterday's simulated actual does
        // not change just because the user opens the page on a different day.
        const dayIndex = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / DAY_MS);
        const seed = (1664525 * dayIndex + 1013904223) >>> 0;
        const variation = seed % 601 - 300;
        const trendDays = Math.floor((new Date(`${date}T00:00:00Z`) - new Date('2026-09-01T00:00:00Z')) / DAY_MS);
        return { date, sales: Math.max(0, dailySales[weekday(date)] + trendDays * 25 + variation) };
    });
}

function createForecast(history, { today, source, isClosed = () => false }) {
    if (history.length < MIN_HISTORY_DAYS) {
        return { status: 'insufficient-history', source, historyDays: history.length, minimumHistoryDays: MIN_HISTORY_DAYS };
    }
    history.forEach((row, index) => {
        if (!validDate(row.date) || !Number.isFinite(row.sales) || row.sales < 0 || (index && row.date !== addDays(history[index - 1].date, 1))) {
            throw new Error('Forecast history must contain consecutive dates and nonnegative finite sales.');
        }
    });
    if (history[history.length - 1].date !== addDays(today, -1)) throw new Error('History must end on the last completed business day.');
    const recentHistory = history.slice(-MAX_HISTORY_DAYS);
    const validation = evaluateSalesModel(recentHistory);
    const model = trainLinearSalesModel(recentHistory);
    const forecast = Array.from({ length: 7 }, (_, index) => {
        const date = addDays(today, index);
        return { date, sales: isClosed(date) ? 0 : round(predictLinearSales(model, date)), closed: isClosed(date) };
    });
    return {
        status: 'ready', source, timezone: 'Asia/Manila', target: 'Sales after discounts, before refunds',
        trainedThrough: history[history.length - 1].date, historyDays: recentHistory.length,
        method: 'Linear regression trained on weekday and sales trend',
        model: { name: 'Linear regression', version: 1, features: ['weekday', 'elapsedDays'], ...model },
        validation: { days: validation.days, modelMae: round(validation.modelMae), baselineMae: round(validation.baselineMae),
            baselineName: 'Four-week weekday average', baselineIsBetter: validation.baselineMae < validation.modelMae,
            folds: validation.folds },
        forecast, total: round(forecast.reduce((sum, row) => sum + row.sales, 0)),
        tomorrow: forecast[1].sales,
    };
}

module.exports = { MIN_HISTORY_DAYS, MAX_HISTORY_DAYS, addDays, businessDate, validDate, demoHistory, createForecast };
