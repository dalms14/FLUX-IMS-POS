const mongoose = require('mongoose');

const WasteSchema = new mongoose.Schema({
    refundId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Refund',
        required: true
    },
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
        required: true
    },
    receiptNo: { type: String, required: true },
    items: [{
        inventoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory' },
        inventoryName: String,
        unit: String,
        amountWasted: Number, // actual amount of ingredient wasted
    }],
    reason: String, // e.g., "Refunded - Damaged product", "Refunded - Wrong order"
    disposedBy: { type: String, required: true },
    notes: { type: String, default: '' },
}, {
    collection: 'waste',
    timestamps: true,
});

module.exports = mongoose.model('Waste', WasteSchema);
