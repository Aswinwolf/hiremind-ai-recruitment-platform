const mongoose = require("mongoose");
const logger = require("./logger");

mongoose.set("strictQuery", true);

module.exports = async function connectDB() {
  if (!process.env.MONGODB_URI) {
    logger.warn("MONGODB_URI not set — skipping DB connect (auth/data features will fail).");
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI, {
    maxPoolSize: Number(process.env.MONGO_POOL_MAX || 50),
    minPoolSize: 5,
    serverSelectionTimeoutMS: 8000,
    socketTimeoutMS: 45000,
  });
  logger.info("MongoDB connected");
};
