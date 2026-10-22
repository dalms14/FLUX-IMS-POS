const express = require('express');
const Transaction = require('../models/Transaction');
const { MIN_HISTORY_DAYS, addDays, businessDate, validDate, demoHistory, createForecast } = require('../services/salesForecast');
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
            const firstDay = start > addDays(today, -28) ? start : addDays(today, -28);
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
        return res.json(data);
    } catch (err) {
        console.error('Sales forecast failed:', err.message);
        return res.status(500).json({ message: 'Unable to generate the sales forecast. Please try again.' });
    }
});

module.exports = router;
