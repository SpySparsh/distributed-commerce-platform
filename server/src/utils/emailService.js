const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user:process.env.EMAIL_USER, // e.g., yourgmail@gmail.com
    pass:process.env.EMAIL_PASS  // App Password only
  }
});

exports.sendOrderConfirmation = async (toEmail, order) => {
  try {
    const items = order.orderItems.map(i =>
      `• ${i.quantity} x ${i.product?.name || 'Item'}`
    ).join('<br>');

    const mailOptions = {
      from: `"E-Shop" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `Your Order #${order._id} is Confirmed`,
      html: `
        <h3>Thank you for your order!</h3>
        <p><strong>Delivery Address:</strong><br>
        ${order.shippingInfo.address}, ${order.shippingInfo.city}, ${order.shippingInfo.pincode}</p>
        <p><strong>Items:</strong><br>${items}</p>
        <p><strong>Total:</strong> ₹${order.totalAmount}</p>
        <p>We’ll notify you when it ships.</p>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Order confirmation email sent');
  } catch (err) {
    console.error('Email sending failed:', err.message);
  }
};
