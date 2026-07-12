const mongoose = require("mongoose");

// A single connection, a single database — no per-facility fan-out, no
// dynamic getModel()/useDb() calls. This is deliberate: the old backend's
// listings endpoints opened a fresh connection per PayServe facility per
// request, which is what exhausted MongoDB Atlas's connection limit and
// took the site down. Mwenyeji-standalone has exactly one schema and one
// database, so there is nothing to fan out over.
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
