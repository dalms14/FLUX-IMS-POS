const mongoose = require('mongoose');

const RefundSchema = new mongoose.Schema({
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
        required: true
    },
    receiptNo: { type: String, required: true },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: String,
        quantity: Number,
        price: Number,
        subtotal: Number,
        isMade: Boolean, // true if product has recipe (made in-house), false if purchased
    }],
    reason: { type: String, required: true }, // e.g., "Wrong order", "Damaged", "Customer request"
    subtotal: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    totalRefunded: { type: Number, required: true },
    refundedBy: { type: String, required: true }, // cashier/admin who processed refund
    refundedByEmail: { type: String, default: '' },
    paymentMethod: { type: String, enum: ['Cash', 'GCash'], required: true },
    status: { type: String, enum: ['pending', 'approved', 'completed', 'rejected'], default: 'pending' },
}, {
    collection: 'refunds',
    timestamps: true,
});

module.exports = mongoose.model('Refund', RefundSchema);
