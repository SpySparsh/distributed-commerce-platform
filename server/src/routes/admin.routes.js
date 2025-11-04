const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middlewares/authMiddleware');
const adminController = require('../controllers/admin.controller');

router.get('/dashboard/summary', protect, adminOnly, adminController.getDashboardStats);
router.get('/top-products', protect, adminOnly, adminController.getTopProducts);

module.exports = router;
