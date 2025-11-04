const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  orderItems: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
      quantity: Number,
    }
  ],
  shippingInfo: {
    address: { type: String, required: true },
    city: String,
    pincode: String,
    phone: String,
  },
  paymentMethod: {
    type: String,
    enum: ['COD', 'Card', 'UPI'],
    default: 'COD',
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  isPaid: {
    type: Boolean,
    default: false,
  },
  isDelivered: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
