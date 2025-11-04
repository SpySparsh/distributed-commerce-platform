const Razorpay = require('razorpay');
require('dotenv').config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

exports.createOrder = async (req, res) => {
  try {
    const { amount } = req.body;
    console.log("RAZORPAY_KEY_ID:", process.env.RAZORPAY_KEY_ID);
console.log("RAZORPAY_SECRET:", process.env.RAZORPAY_KEY_SECRET);


    if (!amount) {
      console.error("Missing amount in request body");
      return res.status(400).json({ message: "Amount is required" });
    }

    const options = {
      amount: amount * 100, // convert to paise
      currency: "INR",
      receipt: "order_rcptid_" + Date.now()
    };

    const order = await razorpay.orders.create(options);
    console.log("Razorpay Order Created:", order);

    res.status(200).json(order);
  } catch (err) {
    console.error("Create Razorpay order error:", err);
    res.status(500).json({ message: "Failed to create Razorpay order" });
  }
};

