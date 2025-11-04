const User = require('../models/user.model');
const Product = require('../models/product.model');

exports.getCart = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('cart.product');

    const cartItems = user.cart.map(item => ({
      _id: item.product._id,
      name: item.product.name,
      price: item.product.price,
      image: item.product.image,
      countInStock: item.product.countInStock,
      qty: item.quantity
    }));

    res.json(cartItems);
  } catch (err) {
    next(err);
  }
};


exports.addToCart = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;
    const user = await User.findById(req.user._id);

    const existingItem = user.cart.find(item => item.product.toString() === productId);

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      user.cart.push({ product: productId, quantity });
    }

    await user.save();
    res.json({ message: 'Product added to cart', cart: user.cart });
  } catch (err) {
    next(err);
  }
};

exports.updateQuantity = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    const user = await User.findById(req.user._id);
    const item = user.cart.find(i => i.product.toString() === productId);

    if (!item) return res.status(404).json({ message: 'Item not found in cart' });

    item.quantity = quantity;
    await user.save();

    res.json({ message: 'Quantity updated', cart: user.cart });
  } catch (err) {
    next(err);
  }
};

exports.removeFromCart = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const user = await User.findById(req.user._id);

    user.cart = user.cart.filter(i => i.product.toString() !== productId);
    await user.save();

    res.json({ message: 'Item removed from cart', cart: user.cart });
  } catch (err) {
    next(err);
  }
};
