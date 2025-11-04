// src/index.js
const express = require("express");
const morgan = require("morgan");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth.routes");
const errorHandler = require("./middlewares/errorHandler");
const productRoutes = require('./routes/product.routes');
const cartRoutes = require('./routes/cart.routes');
const orderRoutes = require('./routes/order.routes');
const reviewRoutes = require('./routes/review.routes');
const paymentRoutes = require('./routes/payment.routes');
const adminRoutes = require('./routes/admin.routes');
const cookieParser = require('cookie-parser');
const userRoutes = require('./routes/users.routes');



dotenv.config();
const app = express();
connectDB();

app.use(cors({
  origin: 'http://localhost:5173', // or ['http://localhost:5173']
  credentials: true
}));
app.use(morgan("dev"));
app.use(express.json());


// Routes
app.use(cookieParser());
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
app.use("/api/auth", authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);


app.use(errorHandler);
// Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
