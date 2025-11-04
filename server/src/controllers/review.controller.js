const Product = require('../models/product.model');

exports.addReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    const product = await Product.findById(req.params.productId);

    if (!product) return res.status(404).json({ message: 'Product not found' });

    const alreadyReviewed = product.reviews.find(r => r.user.toString() === req.user._id.toString());

    if (alreadyReviewed) return res.status(400).json({ message: 'Product already reviewed' });

    const review = {
      user: req.user._id,
      name: req.user.name,
      rating: Number(rating),
      comment
    };

    product.reviews.push(review);
    product.numReviews = product.reviews.length;
    product.rating = product.reviews.reduce((acc, r) => acc + r.rating, 0) / product.numReviews;

    await product.save();

    res.status(201).json({ message: 'Review added' });
  } catch (err) {
    next(err);
  }
};

exports.getProductReviews = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.productId).populate('reviews.user', 'name');
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product.reviews);
  } catch (err) {
    next(err);
  }
};
