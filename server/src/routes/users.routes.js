const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

// Get all users (admin only)
router.get('/', protect, adminOnly, async (req, res, next) => {
  try {
    const users = await User.find({}, '-password'); // exclude password field
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// Delete user
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
});

// Promote user to admin
router.put('/:id/promote', protect, adminOnly, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    user.role = 'admin';
    await user.save();
    res.json({ message: 'User promoted to admin' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
