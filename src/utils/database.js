const mongoose = require('mongoose');

const connections = {};

const connectToDatabase = async (dbName) => {
  if (connections[dbName]) {
    return connections[dbName];
  }

  try {
    console.log(`Creating new connection to database: ${dbName}`);

    let uri;
    if (process.env.MONGODB_URI) {
      const u = new URL(process.env.MONGODB_URI);
      u.pathname = `/${dbName}`;
      uri = u.toString();
    } else {
      uri = `mongodb://127.0.0.1:27017/${dbName}`;
    }

    const connection = mongoose.createConnection(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await connection.asPromise();

    connections[dbName] = connection;

    console.log(`Connected to database: ${dbName}`);

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