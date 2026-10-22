const DAY_MS = 86400000;
const weekday = date => new Date(`${date}T00:00:00Z`).getUTCDay();
const elapsedDays = (start, date) => (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS;

// Ordinary least squares: sales = intercept + trend * day + weekday adjustment.
// Grouping by weekday lets us fit the categorical effects without a matrix library.
function trainLinearSalesModel(history) {
    const startDate = history[0].date;
    const groups = Array.from({ length: 7 }, () => ({ count: 0, days: 0, sales: 0 }));
    for (const row of history) {
        const group = groups[weekday(row.date)];
        group.count += 1;
        group.days += elapsedDays(startDate, row.date);
        group.sales += row.sales;
    }
    if (groups.some(group => group.count < 2)) throw new Error('Training needs at least two examples of each weekday.');
    const means = groups.map(group => ({ day: group.days / group.count, sales: group.sales / group.count }));
    let numerator = 0;
    let denominator = 0;
    for (const row of history) {
        const mean = means[weekday(row.date)];
        const difference = elapsedDays(startDate, row.date) - mean.day;
        numerator += difference * (row.sales - mean.sales);
        denominator += difference * difference;
    }
    const trend = numerator / denominator;
    const weekdayIntercepts = means.map(mean => mean.sales - trend * mean.day);
    return {
        startDate,
        intercept: weekdayIntercepts[0],
        trend,
        weekdayAdjustments: weekdayIntercepts.map(value => value - weekdayIntercepts[0]),
        trainingRows: history.length,
    };
}

function predictLinearSales(model, date) {
    const prediction = model.intercept + model.trend * elapsedDays(model.startDate, date) + model.weekdayAdjustments[weekday(date)];
    return Math.max(0, prediction);
}

function predictWeekdayAverage(history, date) {
    const matches = history.slice(-28).filter(row => weekday(row.date) === weekday(date));
    return matches.reduce((sum, row) => sum + row.sales, 0) / matches.length;
}

// Each test week is predicted using only the records available before that week.
function evaluateSalesModel(history) {
    const folds = [];
    let modelError = 0;
    let baselineError = 0;
    for (let origin = history.length - 14; origin < history.length; origin += 7) {
        const training = history.slice(0, origin);
        const test = history.slice(origin, origin + 7);
        const model = trainLinearSalesModel(training);
        let foldModelError = 0;
        let foldBaselineError = 0;
        for (const row of test) {
            foldModelError += Math.abs(row.sales - predictLinearSales(model, row.date));
            foldBaselineError += Math.abs(row.sales - predictWeekdayAverage(training, row.date));
        }
        modelError += foldModelError;
        baselineError += foldBaselineError;
        folds.push({ trainedThrough: training[training.length - 1].date, testedFrom: test[0].date, testedThrough: test[test.length - 1].date,
            modelMae: foldModelError / test.length, baselineMae: foldBaselineError / test.length });
    }
    return { days: 14, modelMae: modelError / 14, baselineMae: baselineError / 14, folds };
}

module.exports = { trainLinearSalesModel, predictLinearSales, predictWeekdayAverage, evaluateSalesModel };
