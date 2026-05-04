const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    price: {
      type: Number,
      min: 0
    },

    soloPrice: {
      type: Number,
      min: 0
    },

    platterPrice: {
      type: Number,
      min: 0,
      default: null
    },

    category: {
      type: String,
      required: true
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
    },

    description: {
      type: String,
      default: ''
    },

    variants: {
      type: [String],
      default: []
    },

    addons: [{
      name: {
        type: String,
        trim: true
      },
      price: {
        type: Number,
        min: 0,
        default: 0
      }
    }],

    image: {
      type: String,
      default: null
    },

    status: {
      type: String,
      enum: ['available', 'unavailable'],
      default: 'available'
    },

    available: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Add indices for faster queries
ProductSchema.index({ category: 1 });
ProductSchema.index({ categoryId: 1 });
ProductSchema.index({ status: 1 });

module.exports = mongoose.model('Product', ProductSchema);
