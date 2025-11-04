const Order = require('../models/order.model');
const User = require('../models/user.model');
const { sendOrderConfirmation } = require('../utils/emailService');
const Product = require('../models/product.model');

exports.placeOrder = async (req, res, next) => {
  try {
    const { orderItems: bodyOrderItems, shippingInfo, paymentMethod } = req.body;

    if (!shippingInfo || !shippingInfo.address) {
      return res.status(400).json({ message: 'Shipping info is required' });
    }

    let orderItems = [];
    let totalAmount = 0;

    if (bodyOrderItems && bodyOrderItems.length > 0) {
      // 🔹 Buy Now: use items from req.body
      for (let item of bodyOrderItems) {
        const product = await Product.findById(item.product);
        if (!product || typeof product.price !== 'number') {
          return res.status(400).json({ message: 'Invalid product in request' });
        }

        orderItems.push({
          product: product._id,
          quantity: item.quantity,
        });

        totalAmount += product.price * item.quantity;
      }
    } else {
      // 🛒 Cart Checkout
      const user = await User.findById(req.user._id).populate('cart.product');
      if (!user.cart.length) {
        return res.status(400).json({ message: 'Cart is empty' });
      }

      const hasInvalidProduct = user.cart.some(item => !item.product || typeof item.product.price !== 'number');
      if (hasInvalidProduct) {
        return res.status(400).json({ message: 'Cart contains invalid products' });
      }

      orderItems = user.cart.map(item => ({
        product: item.product._id,
        quantity: item.quantity,
      }));

      totalAmount = user.cart.reduce(
        (acc, item) => acc + item.quantity * item.product.price,
        0
      );

      // Clear cart only if cart was used
      user.cart = [];
      await user.save();
    }

    const isPaid = paymentMethod !== 'COD';
    const paidAt = isPaid ? new Date() : null;

    const order = await Order.create({
      user: req.user._id,
      orderItems,
      shippingInfo,
      paymentMethod: paymentMethod || 'COD',
      totalAmount,
      isPaid,
      paidAt
    });


    await sendOrderConfirmation(req.user.email, order);

    res.status(201).json({ message: 'Order placed', order });
  } catch (err) {
    next(err);
  }
};



exports.myOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id }).populate('orderItems.product');
    res.json(orders);
  } catch (err) {
    next(err);
  }
};

exports.getAllOrders = async (req, res, next) => {
  try {
    const orders = await Order.find().populate('user', 'name email');
    res.json(orders);
  } catch (err) {
    next(err);
  }
};

exports.markAsPaid = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.isPaid) {
      return res.status(400).json({ message: 'Order is already marked as paid' });
    }

    order.isPaid = true;
    order.paidAt = new Date();

    await order.save();

    res.json({ message: 'Order marked as paid' });
  } catch (err) {
    next(err);
  }
};


exports.markAsDelivered = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId);
    order.isDelivered = true;
    await order.save();
    res.json({ message: 'Order marked as delivered' });
  } catch (err) {
    next(err);
  }
};

exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('orderItems.product');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Ensure user is owner or admin
    if (order.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(order);
  } catch (err) {
    next(err);
  }
};
