const express = require('express');
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const Recipe = require('../models/Recipe');
const Inventory = require('../models/Inventory');
const { createIngredientDemand, demoIngredientDemand } = require('../services/ingredientDemand');
const { trackForecast } = require('../services/forecastTracking');
const { MIN_HISTORY_DAYS, MAX_HISTORY_DAYS, addDays, businessDate, validDate, demoHistory, createForecast } = require('../services/salesForecast');
const router = express.Router();

router.get('/', async (req, res) => {
    const source = req.query.source || 'demo';
    if (!['demo', 'real'].includes(source)) return res.status(400).json({ message: 'Choose demo or real sales.' });
    const today = businessDate();
    const start = process.env.FORECAST_REAL_SALES_START_DATE;
    const closedWeekdays = (process.env.FORECAST_CLOSED_WEEKDAYS || '').split(',').filter(Boolean).map(Number);
    const closedDates = (process.env.FORECAST_CLOSED_DATES || '').split(',').filter(Boolean);
    try {
        let history;
        let isClosed = () => false;
        if (source === 'demo') {
            history = demoHistory(today);
        } else {
            if (!start) return res.json({ status: 'awaiting-real-sales', source,
                message: 'Real sales forecasting is not enabled yet. Current test transactions are excluded. Start recording verified client sales after handover.' });
            if (!validDate(start) || closedWeekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6) || closedDates.some(date => !validDate(date))) {
                return res.status(503).json({ message: 'Real-sales forecast setup needs correction. Contact the system administrator.' });
            }
            const firstDay = start > addDays(today, -MAX_HISTORY_DAYS) ? start : addDays(today, -MAX_HISTORY_DAYS);
            const dates = [];
            for (let date = firstDay; date < today; date = addDays(date, 1)) dates.push(date);
            if (dates.length < MIN_HISTORY_DAYS) return res.json({ status: 'insufficient-history', source, historyDays: dates.length, minimumHistoryDays: MIN_HISTORY_DAYS });
            const rows = await Transaction.aggregate([
                { $match: { orderStatus: 'completed', paymentMethod: { $ne: 'Cancelled' },
                    createdAt: { $gte: new Date(`${firstDay}T00:00:00+08:00`), $lt: new Date(`${today}T00:00:00+08:00`) } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Manila' } }, sales: { $sum: '$total' } } },
            ]);
            const totals = new Map(rows.map(row => [row._id, row.sales]));
            const scheduledClosure = date => closedWeekdays.includes(new Date(`${date}T00:00:00Z`).getUTCDay()) || closedDates.includes(date);
            // Actual transactions take precedence over a scheduled closure.
            isClosed = date => scheduledClosure(date) && !totals.has(date);
            const missing = dates.filter(date => !totals.has(date) && !isClosed(date));
            if (missing.length) return res.json({ status: 'incomplete-history', source, missingDays: missing.length,
                message: 'Some business days have no confirmed sales records. Confirm closed days or complete the sales history before forecasting.' });
            history = dates.map(date => ({ date, sales: totals.get(date) || 0 }));
            if (history.every(row => row.sales === 0)) return res.json({ status: 'insufficient-sales', source, message: 'No completed real sales are available to learn from yet.' });
        }
        const data = { ...createForecast(history, { today, source, isClosed }), generatedAt: new Date().toISOString() };
        if (data.status === 'ready') {
            try {
                data.tracking = await trackForecast(data, { today, start, isClosed });
            } catch (err) {
                console.error('Forecast tracking failed:', err.message);
                data.tracking = { source, unavailable: true };
            }
        }
        return res.json(data);
    } catch (err) {
        console.error('Sales forecast failed:', err.message);
        return res.status(500).json({ message: 'Unable to generate the sales forecast. Please try again.' });
    }
});

router.get('/ingredient-demand', async (req, res) => {
    const source = req.query.source || 'demo';
    if (!['demo', 'real'].includes(source)) return res.status(400).json({ message: 'Choose demo or real sales.' });
    const today = businessDate();
    try {
        if (source === 'demo') return res.json(demoIngredientDemand(today));
        const start = process.env.FORECAST_REAL_SALES_START_DATE;
        if (!start) return res.json({ source, status: 'awaiting-real-sales', message: 'Ingredient estimates need verified client sales. Real sales forecasting is not enabled yet.' });
        const weekdays = (process.env.FORECAST_CLOSED_WEEKDAYS || '').split(',').filter(Boolean).map(Number);
        const closures = (process.env.FORECAST_CLOSED_DATES || '').split(',').filter(Boolean);
        if (!validDate(start) || weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6) || closures.some(date => !validDate(date))) {
            return res.status(503).json({ message: 'Real-sales forecast setup needs correction. Contact the system administrator.' });
        }
        const first = start > addDays(today, -MAX_HISTORY_DAYS) ? start : addDays(today, -MAX_HISTORY_DAYS);
        const dates = [];
        for (let date = first; date < today; date = addDays(date, 1)) dates.push(date);
        if (dates.length < MIN_HISTORY_DAYS) return res.json({ source, status: 'insufficient-history', historyDays: dates.length,
            minimumHistoryDays: MIN_HISTORY_DAYS, message: `Ingredient estimates need at least ${MIN_HISTORY_DAYS} completed days of verified product sales.` });
        const filter = { orderStatus: 'completed', paymentMethod: { $ne: 'Cancelled' },
            createdAt: { $gte: new Date(`${first}T00:00:00+08:00`), $lt: new Date(`${today}T00:00:00+08:00`) } };
        const [totals, transactions] = await Promise.all([
            Transaction.aggregate([{ $match: filter }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Manila' } }, count: { $sum: 1 } } }]),
            Transaction.find(filter).select('createdAt orderStatus paymentMethod items').lean(),
        ]);
        const recorded = new Set(totals.map(row => row._id));
        const isClosed = date => !recorded.has(date) && (weekdays.includes(new Date(`${date}T00:00:00Z`).getUTCDay()) || closures.includes(date));
        if (dates.some(date => !recorded.has(date) && !isClosed(date))) return res.json({ source, status: 'incomplete-history',
            message: 'Some business days have no confirmed sales. Complete the history or confirm closed days before estimating ingredient needs.' });
        const productIds = [...new Set(transactions.flatMap(transaction => (transaction.items || []).map(item => item.productId).filter(Boolean)).map(String))];
        const [products, recipes, inventory] = await Promise.all([
            Product.find({ _id: { $in: productIds } }).select('name available status archived variants variantGroups addons platterPrice').lean(),
            Recipe.find({ productId: { $in: productIds } }).lean(),
            Inventory.find({}).select('name unit stock expirationDate expirationBatches archived').lean(),
        ]);
        return res.json(createIngredientDemand({ today, dates, transactions, products, recipes, inventory, source, isClosed }));
    } catch (error) {
        console.error('Ingredient demand forecast failed:', error.message);
        return res.status(500).json({ message: 'Ingredient demand could not be estimated. Please try again.' });
    }
});

module.exports = router;
