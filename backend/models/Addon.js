const mongoose = require('mongoose');

const AddonSchema = new mongoose.Schema(
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
    price: {
      type: Number,
      min: 0,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    collection: 'addons',
    timestamps: true,
  }
);

AddonSchema.pre('validate', function setNameKey() {
  this.nameKey = String(this.name || '').trim().toLowerCase();
});

module.exports = mongoose.model('Addon', AddonSchema);
