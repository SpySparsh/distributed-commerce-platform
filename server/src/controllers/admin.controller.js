const Order = require('../models/order.model');
const User = require('../models/user.model');
const Product = require('../models/product.model');
const mongoose = require('mongoose');


exports.getDashboardStats = async (req, res, next) => {
  try {
    const totalOrders = await Order.countDocuments();
    const totalRevenue = await Order.aggregate([
      { $match: { isPaid: true } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);

    const revenue = totalRevenue[0]?.total || 0;

    const ordersByStatus = await Order.aggregate([
      { $group: { _id: "$isDelivered", count: { $sum: 1 } } }
    ]);

    const userCount = await User.countDocuments();
    res.json({
      totalOrders,
      revenue,
      ordersByStatus,
      userCount
    });
  } catch (err) {
    next(err);
  }
};

exports.getTopProducts = async (req, res, next) => {
  try {
    const topProducts = await Order.aggregate([
      { $unwind: "$orderItems" },
      { $group: {
          _id: "$orderItems.product",
          totalSold: { $sum: "$orderItems.quantity" }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: "$product" },
      {
        $project: {
          name: "$product.name",
          totalSold: 1,
          price: "$product.price"
        }
      }
    ]);

    res.json(topProducts);
  } catch (err) {
    next(err);
  }
};
