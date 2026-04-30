const mongoose = require('mongoose');

const { MongoMemoryServer } = require('mongodb-memory-server');

const connectDB = async () => {
  try {
    console.log('Attempting to connect to MongoDB...');
    // Add a quick timeout for the connection attempt so it doesn't hang forever
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('MongoDB Connected to Atlas...');
  } catch (err) {
    console.warn(`Failed to connect to Atlas (${err.message}). Falling back to In-Memory Database...`);
    try {
      const mongoServer = await MongoMemoryServer.create();
      const uri = mongoServer.getUri();
      await mongoose.connect(uri);
      console.log('MongoDB Connected to In-Memory Fallback successfully!');
    } catch (fallbackErr) {
      console.error('Database fallback connection error:', fallbackErr.message);
      throw fallbackErr;
    }
  }
};

module.exports = connectDB;
