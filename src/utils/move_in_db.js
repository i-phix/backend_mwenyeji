const mongoose = require("mongoose");

let moveInConnection = null;

const MODEL_SOURCES = {
  MoveInApplication: "MoveinApplication",
  MoveInLandlord: "MoveinLandlord",
  MoveInUser: "MoveinUser",
  CustomerPreference: "CustomerPreference",
};

const GENERIC_MODELS = [
  "MoveInUnit",
  "MoveInViewingSlot",
  "MoveInBooking",
  "MoveInReservation",
  "MoveInNotification",
  "MoveInConversation",
  "MoveInMessage",
  "MoveInPayment",
  "MoveInAuditLog",
  "MoveInLandlordUser",
  "MoveInHandoffToken",
  "MoveInLandmark",
  "MoveInPlace",
  "MoveInCounty",
  "MoveInFeaturedPackage",
  "MoveInPOI",
];

function buildConnectionString(dbName, secured, username, password, url, port) {
  const host = `${url}:${port}`;
  if (secured === false) return `mongodb://${host}/${dbName}`;
  return `mongodb://${username}:${password}@${host}/${dbName}?authSource=admin`;
}

function genericSchema() {
  return new mongoose.Schema({}, { strict: false, timestamps: true });
}

function registerModel(connection, name, schema) {
  if (connection.models[name]) return connection.models[name];
  return connection.model(name, schema);
}

function registerMoveInModels(payservedb, connection) {
  const moveIn = {};

  for (const [moveInName, sourceName] of Object.entries(MODEL_SOURCES)) {
    const sourceModel = payservedb[sourceName];
    moveIn[moveInName] = registerModel(
      connection,
      moveInName,
      sourceModel?.schema || genericSchema(),
    );
  }

  for (const modelName of GENERIC_MODELS) {
    moveIn[modelName] = registerModel(connection, modelName, genericSchema());
  }

  payservedb.moveIn = moveIn;
  return moveIn;
}

function installMoveInDb(payservedb) {
  if (typeof payservedb.connectToMoveInDB === "function") return payservedb;

  payservedb.connectToMoveInDB = async function connectToMoveInDB(
    dbName,
    secured,
    username,
    password,
    url,
    port,
  ) {
    if (moveInConnection?.readyState === 1) {
      registerMoveInModels(payservedb, moveInConnection);
      return moveInConnection;
    }

    const connectionString = buildConnectionString(
      dbName,
      secured,
      username,
      password,
      url,
      port,
    );
    moveInConnection = mongoose.createConnection(connectionString, {
      useNewUrlParser: true,
    });
    await moveInConnection.asPromise();
    registerMoveInModels(payservedb, moveInConnection);
    console.log(`Connected to MongoDB database: ${dbName}`);
    return moveInConnection;
  };

  return payservedb;
}

module.exports = installMoveInDb;
