const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.get('/', productController.list);
router.get('/category/:category', productController.getByCategory);
router.get('/:id', productController.getOne);
router.post('/', protect, adminOnly, productController.create);
router.put('/:id', protect, adminOnly, productController.update); // ✅ cleaner now
router.delete('/:id', protect, adminOnly, productController.remove);

module.exports = router;
