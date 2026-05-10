const mongoose = require('mongoose');

const DiscountSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    nameKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    percentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    collection: 'discounts',
    timestamps: true,
  }
);

DiscountSchema.pre('validate', function setNameKey() {
  this.nameKey = String(this.name || '').trim().toLowerCase();
});

module.exports = mongoose.model('Discount', DiscountSchema);
