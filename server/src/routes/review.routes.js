const express = require('express');
const router = express.Router();
const { addReview, getProductReviews } = require('../controllers/review.controller');
const { protect } = require('../middlewares/authMiddleware');

router.post('/:productId', protect, addReview);
router.get('/:productId', getProductReviews);

module.exports = router;
