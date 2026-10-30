const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    dataset: { type: String, required: true },
    source: { type: String, enum: ['demo', 'real'], required: true },
    targetDate: { type: String, required: true },
    predictedSales: { type: Number, required: true, min: 0 },
    generatedAt: { type: Date, required: true },
    trainedThrough: { type: String, required: true },
    method: String,
});
// First prediction wins, including concurrent requests / multiple server instances.
schema.index({ dataset: 1, targetDate: 1 }, { unique: true });
module.exports = mongoose.model('ForecastSnapshot', schema);
