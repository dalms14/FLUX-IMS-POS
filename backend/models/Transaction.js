const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    receiptNo:     { type: String, required: true, unique: true },
    cashier:       { type: String, required: true },
    cashierEmail:  { type: String, default: '' },
    customerType:  { type: String, enum: ['customer', 'elite', 'pagibig', 'pwd_senior'], default: 'customer' },
    eliteMember:   { name: String, idNumber: String },
    items: [{
        productId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name:            String,
        category:        String,
        size:            String,
        selectedVariant: String,
        upgrades: [{
            name:        String,
            price:       Number,
        }],
        price:           Number,
        quantity:        Number,
        subtotal:        Number,
    }],
    subtotal:       { type: Number, required: true },
    tax:            { type: Number, default: 0 },
    discount:       { type: Number, default: 0 },
    total:          { type: Number, required: true },
    paymentMethod:  { type: String, enum: ['Cash', 'GCash'], required: true },
    amountTendered: { type: Number, default: 0 },
    change:         { type: Number, default: 0 },
    gcashReference: { type: String, default: null },
}, {
    collection: 'transactions',
    timestamps: true,
});

module.exports = mongoose.model('Transaction', TransactionSchema);
