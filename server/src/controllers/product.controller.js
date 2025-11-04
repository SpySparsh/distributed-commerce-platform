const productService = require('../services/product.service');


exports.create = async (req, res, next) => {
  try {
    const product = await productService.createProduct(req.body);
    res.status(201).json({ product });
  } catch (err) {
    next(err);
  }
};

exports.list = async (req, res, next) => {
  try {
    const { keyword, category, min, max, page, limit } = req.query;
    const data = await productService.getProducts({ keyword, category, min, max, page, limit });
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const product = await productService.getProductById(req.params.id);
    res.json(product);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const updated = await productService.updateProductById(req.params.id, req.body);

    if (!updated) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const deleted = await productService.deleteProductById(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    next(err);
  }
};

exports.getByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const products = await ProductService.getProductsByCategory(category, limit);
    res.json(products);
  } catch (err) {
    next(err);
  }
};