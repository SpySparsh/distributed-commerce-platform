const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {
  generateAccessToken,
  generateRefreshToken
} = require('../utils/generateToken');

// ------------------ REGISTER ------------------
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: 'All fields are required' });

    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(400).json({ message: 'User already exists' });

    const user = await User.create({
      name,
      email,
      password, // Will be hashed by Mongoose pre-save
      role: 'user'
    });

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      accessToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    next(err);
  }
};

// ------------------ LOGIN ------------------
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required' });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: 'Invalid email or password' });

    const isMatch = await user.matchPassword(password);
    if (!isMatch)
      return res.status(400).json({ message: 'Invalid email or password' });

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({
      accessToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    next(err);
  }
};


// ------------------ LOGOUT ------------------
exports.logout = (req, res) => {
  res.clearCookie('refreshToken');
  res.status(200).json({ message: 'Logged out successfully' });
};

// ------------------ REFRESH TOKEN ------------------

exports.refreshToken = async (req, res) => {
  const token = req.cookies.refreshToken;

  if (!token) return res.status(401).json({ message: 'No refresh token provided' });

  jwt.verify(token, process.env.JWT_REFRESH_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired refresh token' });

    try {
      const user = await User.findById(decoded.id).select('-password');
      if (!user) return res.status(404).json({ message: 'User not found' });

      const accessToken = generateAccessToken(decoded.id);

      res.status(200).json({
        accessToken,
        user, // ✅ include the user object
      });
    } catch (error) {
      console.error('Refresh error:', error);
      res.status(500).json({ message: 'Server error during refresh' });
    }
  });
};
