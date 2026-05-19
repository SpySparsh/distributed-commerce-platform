const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

class DatabaseConnectionError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'DatabaseConnectionError';

    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

const getDatabaseUri = () => {
  if (!process.env.MONGO_URI) {
    throw new DatabaseConnectionError('MONGO_URI is required to connect to MongoDB.');
  }

  return process.env.MONGO_URI;
};

const getErrorMessage = (err) => {
  if (err instanceof Error) {
    return err.message;
  }

  return 'Unknown database connection error';
};

const connectDB = async () => {
  try {
    await mongoose.connect(getDatabaseUri());
    console.log("Connected to DB:", mongoose.connection.name);

  } catch (err) {
    console.error("MongoDB connection failed:", getErrorMessage(err));
    process.exit(1);
  }
};

module.exports = connectDB;
module.exports.DatabaseConnectionError = DatabaseConnectionError;
