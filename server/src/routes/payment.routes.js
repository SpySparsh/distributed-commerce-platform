const express = require('express');
const router = express.Router();
const { createOrder } = require('../controllers/payment.controller');
const { protect } = require('../middlewares/authMiddleware');

router.post('/order', protect, createOrder);

module.exports = router;
