const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', default: null },
    purchaseOrderNo: { type: String, default: '' },
    audiences: { type: [String], default: [] },
    readBy: [{ email: String, readAt: Date }],
    resolvedAt: { type: Date, default: null },
}, { collection: 'notifications', timestamps: true });

NotificationSchema.index({ resolvedAt: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);
