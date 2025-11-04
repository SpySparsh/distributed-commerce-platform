const Product = require('../models/product.model');

exports.createProduct = async (data) => {
  const product = await Product.create(data);
  return product;
};

exports.getProducts = async ({ keyword, category, min, max, page = 1, limit = 0 }) => {
  const filter = {};

  if (keyword) {
  const words = keyword.trim().split(/\s+/);

  // Require *all* words to match somewhere in name or category
  filter.$and = words.map((word) => ({
    $or: [
      { name: { $regex: word, $options: 'i' } },
      { category: { $regex: word, $options: 'i' } }
    ]
  }));
}

  if (category) {
    filter.category = category;
  }
  if (min || max) {
    filter.price = {};
    if (min) filter.price.$gte = min;
    if (max) filter.price.$lte = max;
  }

  const skip = (page - 1) * limit;
  const products = await Product.find(filter).skip(skip).limit(limit);
  const total = await Product.countDocuments(filter);

  return { products, total };
};

exports.getProductById = async (id) => {
  const product = await Product.findById(id);
  if (!product) throw new Error('Product not found');
  return product;
};

exports.updateProductById = async (id, data) => {
  const product = await Product.findById(id);
  if (!product) return null;

  Object.assign(product, data);
  return await product.save();
};

exports.deleteProductById = async (id) => {
  const deleted = await Product.findByIdAndDelete(id);
  return deleted; // returns `null` if not found
};

exports.getProductsByCategory = async (category, limit = 10) => {
  return await Product.find({ category }).limit(limit);
};
