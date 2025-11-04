const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.post('/', protect, orderController.placeOrder);
router.get('/my-orders', protect, orderController.myOrders);
router.get('/admin/all', protect, adminOnly, orderController.getAllOrders);
router.get('/:id', protect, orderController.getOrderById);
router.patch('/:orderId/pay', protect, orderController.markAsPaid);
router.patch('/:orderId/deliver', protect, adminOnly, orderController.markAsDelivered);

module.exports = router;
