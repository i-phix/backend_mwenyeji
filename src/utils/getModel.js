const { connectToMongoDB } = require("./dbConnection");
const payservedb = require("payservedb");

// Cache for the main MongoDB connection
let cachedConnection = null;

// Cache for facility database connections
const dbCache = new Map();

// Cache for facility info to avoid repeated lookups
const facilityCache = new Map();
const FACILITY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes TTL for facility cache

/**
 * Get or create the main MongoDB connection (singleton pattern)
 */
const getConnection = () => {
  if (!cachedConnection) {
    cachedConnection = connectToMongoDB();

    // Handle connection errors
    cachedConnection.on("error", (err) => {
      console.error("MongoDB connection error:", err.message);
      // Reset connection cache on error to allow reconnection
      cachedConnection = null;
    });

    cachedConnection.on("disconnected", () => {
      console.log(
        "MongoDB disconnected - connection will be re-established on next request",
      );
      cachedConnection = null;
      dbCache.clear();
    });
  }
  return cachedConnection;
};

/**
 * Get facility info with caching
 */
const getFacilityInfo = async (facilityId) => {
  if (!facilityId) {
    return null;
  }
  const cacheKey = facilityId.toString();
  const cached = facilityCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < FACILITY_CACHE_TTL) {
    return cached.facility;
  }

  const facility = await payservedb.Facility.findById(facilityId).lean();
  facilityCache.set(cacheKey, {
    facility,
    timestamp: Date.now(),
  });

  return facility;
};

/**
 * Get or create a database connection for a specific facility
 */
const getDatabase = async (modelName, schema, facilityId) => {
  try {
    const connection = getConnection();

    // Wait for connection to be ready
    if (connection.readyState !== 1) {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("MongoDB connection timeout"));
        }, 30000);

        connection.once("connected", () => {
          clearTimeout(timeout);
          resolve();
        });

        connection.once("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });

        // If already connected, resolve immediately
        if (connection.readyState === 1) {
          clearTimeout(timeout);
          resolve();
        }
      });
    }

    // Fetch the facility information (with caching)
    const facility = await getFacilityInfo(facilityId);
    const databaseName = facility ? facility.dbName : "payserve_property";

    // Check if we have a cached database connection
    const dbCacheKey = databaseName;
    let db = dbCache.get(dbCacheKey);

    if (!db) {
      // Create new database connection and cache it
      db = connection.useDb(databaseName, { useCache: true });
      dbCache.set(dbCacheKey, db);
    }

    // Register the model if not already registered
    if (!db.models[modelName]) {
      db.model(modelName, schema);
    }

    return db;
  } catch (error) {
    console.error("Error in getDatabase:", error.message);
    throw error;
  }
};

/**
 * Get a Mongoose model for a specific facility's database
 * This function caches connections and models to prevent connection leaks
 *
 * If facilityId is not provided, it will use the default database (payserve_property)
 * This is useful for global/core models that are not facility-specific
 */
exports.getModel = async (modelName, schema, facilityId) => {
  try {
    // facilityId can be undefined for global/core models - they'll use default database
    const tenantDb = await getDatabase(modelName, schema, facilityId);
    return tenantDb.model(modelName);
  } catch (error) {
    console.error("Error in getModel:", error.message);
    throw error;
  }
};

/**
 * Get the cached connection (useful for health checks)
 */
exports.getConnection = getConnection;

/**
 * Clear all caches (useful for testing or forced reconnection)
 */
exports.clearCaches = () => {
  dbCache.clear();
  facilityCache.clear();
};

/**
 * Get connection stats for monitoring
 */
exports.getConnectionStats = () => {
  return {
    hasConnection: cachedConnection !== null,
    connectionState: cachedConnection ? cachedConnection.readyState : null,
    cachedDatabases: dbCache.size,
    cachedFacilities: facilityCache.size,
  };
};
