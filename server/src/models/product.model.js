const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  brand: String,
  price: {
    type: Number,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  countInStock: {
    type: Number,
    default: 0,
  },
  image: String,
  reviews: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: String,
      rating: { type: Number, required: true },
      comment: String
    }
  ],
  rating: {
    type: Number,
    default: 0
  },
  numReviews: {
    type: Number,
    default: 0
  }

}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
