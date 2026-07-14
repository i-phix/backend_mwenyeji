const mongoose = require("mongoose");

const connections = {};

const DB_USER = "Ps";
const DB_PASSWORD = "Letmein987";
const DB_HOST = "127.0.0.1";
const AUTH_SOURCE = "admin";

const buildUri = (dbName) => {
  if (process.env.MONGODB_URI) {
    const u = new URL(process.env.MONGODB_URI);
    u.pathname = `/${dbName}`;
    return u.toString();
  }
  return `mongodb://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:27017/${dbName}?authSource=${AUTH_SOURCE}`;
};

const connectToDatabase = async (dbName) => {
  if (connections[dbName]) {
    return connections[dbName];
  }

  try {
    console.log(`Creating new connection to database: ${dbName}`);

    const uri = buildUri(dbName);

    const connection = mongoose.createConnection(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,

      autoIndex: true,
      connectTimeoutMS: 60000,
      socketTimeoutMS: 60000,
      serverSelectionTimeoutMS: 60000,
      heartbeatFrequencyMS: 30000,
      retryWrites: true,
      maxPoolSize: 10,
      minPoolSize: 2,
    });

    await connection.asPromise();

    connections[dbName] = connection;

    console.log(`Connected to database: ${dbName}`);

    connection.on("error", (err) => {
      console.error(`MongoDB error on ${dbName}:`, err);
    });

    connection.on("disconnected", () => {
      console.log(`MongoDB disconnected from ${dbName}`);
    });

    return connection;
  } catch (error) {
    console.error(`Connection error on database ${dbName}:`, error);

    throw new Error(`Could not connect to database ${dbName}`);
  }
};

const getModel = async (dbName, modelName, schema) => {
  const dbConnection = await connectToDatabase(dbName);

  if (dbConnection.models[modelName]) {
    return dbConnection.models[modelName];
  }

  return dbConnection.model(modelName, schema);
};

module.exports = { getModel };
