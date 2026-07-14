const mongoose = require("mongoose");
async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not set");
  }

  mongoose.set("strictQuery", true);

  await mongoose.connect(process.env.MONGODB_URI, {
    maxPoolSize: 20,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });

  console.log(`[db] connected to MongoDB (db: ${mongoose.connection.name})`);

  mongoose.connection.on("error", (err) => {
    console.error("[db] connection error:", err.message);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("[db] disconnected — mongoose will attempt to reconnect");
  });

  return mongoose.connection;
}

module.exports = { connectDB };
