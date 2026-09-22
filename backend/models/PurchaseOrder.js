const mongoose = require('mongoose');

const PurchaseOrderItemSchema = new mongoose.Schema({
    inventoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', default: null },
    name: { type: String, required: true, trim: true },
    unit: { type: String, required: true, trim: true },
    category: { type: String, default: 'General', trim: true },
    lowStockAt: { type: Number, default: 0, min: 0 },
    orderedQuantity: { type: Number, required: true, min: 0.000001 },
    receivedQuantity: { type: Number, default: 0, min: 0 },
    unitCost: { type: Number, default: 0, min: 0 },
}, { _id: true });

const ReceiptSchema = new mongoose.Schema({
    receivedAt: { type: Date, default: Date.now },
    receivedBy: { type: String, default: 'System' },
    receivedByEmail: { type: String, default: '' },
    items: [{
        itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
        inventoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 0.000001 },
        expirationDate: { type: Date, default: null },
        note: { type: String, default: '' },
    }],
}, { _id: true });

const PendingReceiptSchema = new mongoose.Schema({
    arrivedAt: { type: Date, default: Date.now },
    reportedBy: { type: String, default: 'System' },
    reportedByEmail: { type: String, default: '' },
    status: { type: String, enum: ['Pending Approval', 'Approved', 'Rejected'], default: 'Pending Approval' },
    reviewedBy: { type: String, default: '' },
    reviewedByEmail: { type: String, default: '' },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },
    items: [{
        itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 0.000001 },
        expirationDate: { type: Date, default: null },
        note: { type: String, default: '' },
    }],
}, { _id: true });

const PurchaseOrderSchema = new mongoose.Schema({
    purchaseOrderNo: { type: String, required: true, unique: true, trim: true },
    supplierName: { type: String, required: true, trim: true },
    supplierContact: { type: String, default: '', trim: true },
    orderDate: { type: Date, default: Date.now },
    expectedDeliveryDate: { type: Date, default: null },
    status: {
        type: String,
        enum: ['Draft', 'Approved', 'Arrival Pending Approval', 'Partially Received', 'Received', 'Cancelled'],
        default: 'Draft',
    },
    notes: { type: String, default: '', trim: true },
    assignedReceiver: {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        name: { type: String, default: '' },
        email: { type: String, default: '' },
    },
    items: { type: [PurchaseOrderItemSchema], validate: value => Array.isArray(value) && value.length > 0 },
    receipts: { type: [ReceiptSchema], default: [] },
    pendingReceipts: { type: [PendingReceiptSchema], default: [] },
    createdBy: { type: String, default: 'System' },
    createdByEmail: { type: String, default: '' },
    approvedBy: { type: String, default: '' },
    approvedAt: { type: Date, default: null },
    cancelledBy: { type: String, default: '' },
    cancelledAt: { type: Date, default: null },
}, {
    collection: 'purchase_orders',
    timestamps: true,
});

PurchaseOrderSchema.index({ status: 1, createdAt: -1 });
PurchaseOrderSchema.index({ supplierName: 1, createdAt: -1 });

module.exports = mongoose.model('PurchaseOrder', PurchaseOrderSchema);
