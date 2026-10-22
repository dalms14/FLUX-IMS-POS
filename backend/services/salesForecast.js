const DAY_MS = 86400000;
const MIN_HISTORY_DAYS = 28;
const round = value => Math.round(value * 100) / 100;
const weekday = date => new Date(`${date}T00:00:00Z`).getUTCDay();
const addDays = (date, days) => new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
const businessDate = (now = new Date()) => new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && addDays(value, 0) === value;

// Fixed synthetic history is generated in memory, never inserted into the POS database.
function demoHistory(today) {
    const dailySales = [5800, 4000, 4300, 4500, 4800, 6200, 7000];
    return Array.from({ length: 28 }, (_, index) => {
        const date = addDays(today, index - 28);
        const weeklyIncrease = Math.floor(index / 7) * 200;
        return { date, sales: dailySales[weekday(date)] + weeklyIncrease };
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
    const recentHistory = history.slice(-28);
    // Each weekday occurs four times in the previous 28 completed days.
    const forecast = Array.from({ length: 7 }, (_, index) => {
        const date = addDays(today, index);
        const sameWeekday = recentHistory.filter(row => weekday(row.date) === weekday(date));
        const average = sameWeekday.reduce((sum, row) => sum + row.sales, 0) / sameWeekday.length;
        return { date, sales: isClosed(date) ? 0 : round(average), closed: isClosed(date) };
    });
    return {
        status: 'ready', source, timezone: 'Asia/Manila', target: 'Sales after discounts, before refunds',
        trainedThrough: history[history.length - 1].date, historyDays: recentHistory.length,
        method: 'Average sales for the same weekday over the past four weeks',
        forecast, total: round(forecast.reduce((sum, row) => sum + row.sales, 0)),
        tomorrow: forecast[1].sales,
    };
}

module.exports = { MIN_HISTORY_DAYS, addDays, businessDate, validDate, demoHistory, createForecast };
