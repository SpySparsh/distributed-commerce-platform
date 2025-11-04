const User = require('../models/user.model');
const generateToken = require('../utils/generateToken');

exports.registerUser = async ({ name, email, password }) => {
  const existing = await User.findOne({ email });
  if (existing) throw new Error('User already exists');

  const user = await User.create({ name, email, password });
  const token = generateToken(user._id);
  return { user, token };
};

exports.loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email });
  if (!user || !(await user.matchPassword(password))) {
    throw new Error('Invalid email or password');
  }
  const token = generateToken(user._id);
  return { user, token };
};

