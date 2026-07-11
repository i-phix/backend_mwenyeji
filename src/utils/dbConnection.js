const { default: mongoose } = require("mongoose");

const mongoOptions = {
  autoIndex: true,
  connectTimeoutMS: 60000, // Increased from 30s to 60s
  socketTimeoutMS: 60000, // Increased from 30s to 60s
  serverSelectionTimeoutMS: 60000, // Add server selection timeout
  heartbeatFrequencyMS: 30000, // Add heartbeat frequency
  retryWrites: true, // Enable retry for write operations
  maxPoolSize: 10, // Connection pooling
  minPoolSize: 2, // Minimum connections in pool
};

// Prefer the full Atlas URI from env; fall back to legacy local config
const databaseURI =
  process.env.MONGODB_URI ||
  "mongodb://Ps:Letmein987@127.0.0.1:27017/?authSource=admin";

// Create connection with retry logic
const connect = () => {
  console.log("Connecting to MongoDB...");
  return mongoose.createConnection(databaseURI, mongoOptions);
};

const connectToMongoDB = () => {
  const db = connect();

  db.on("error", (err) => {
    console.error("MongoDB connection error:", err.message);
    console.error("Error details:", err);
    // Don't exit process, allow application to handle reconnection
  });

  db.on("connected", () => {
    console.log("Successfully connected to MongoDB");
  });

  db.on("disconnected", () => {
    console.log("MongoDB disconnected");
  });

  db.on("reconnected", () => {
    console.log("MongoDB reconnected");
  });

  // Handle process termination - use async/await instead of callback
  process.on("SIGINT", async () => {
    try {
      await db.close();
      console.log("MongoDB connection closed due to application termination");
      process.exit(0);
    } catch (err) {
      console.error("Error closing MongoDB connection:", err);
      process.exit(1);
    }
  });

  return db;
};

exports.connectToMongoDB = connectToMongoDB;
