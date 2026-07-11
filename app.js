const cluster = require("cluster");
const os = require("os");
const fastify = require("fastify");
const metricsPlugin = require("fastify-metrics");
const payservedb = require("payservedb");
require("./src/utils/move_in_db")(payservedb);
require("./src/utils/customer_obsession_models")(payservedb);
const helmet = require("@fastify/helmet");
require("dotenv").config();
const { addLog } = require("./config/batchLogger");
const archiveOldLogs = require("./config/archiveOldLogs");
const logger = require("./config/winston");
const cors = require("@fastify/cors");
const numCPUs = os.cpus().length;
const multer = require("fastify-multer");
const fastifyStatic = require("@fastify/static");
const path = require("path");
const Redis = require("ioredis");
const {
  startEscalatedMetersCron,
} = require("./src/cron/escalated_meters.cron");

// startEscalatedMetersCron();
if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  //Change url for string connection with authentication
  const mongoose = require("mongoose");
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log("MongoDB connected"))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  cluster.on("exit", (worker, code, signal) => {
    console.error(
      `Worker ${worker.process.pid} died. Code: ${code}, Signal: ${signal}`,
    );
    logger.error(
      `Worker ${worker.process.pid} died with code: ${code}, signal: ${signal}`,
    );
    cluster.fork(); // Restart the worker
  });
} else {
  // Wrap worker code in async function to use await
  (async () => {
    const server = fastify({
      logger: true,
      bodyLimit: 100 * 1024 * 1024, // Increase to 100MB or adjust as needed
    });

    const errorHandling = require("./config/errorHandling");
    const apiLog = require("./config/apiLog");

    // Error handling setup
    errorHandling();

    // Global logger
    server.decorate("logger", logger);

    // CRITICAL: Register CORS FIRST before any other plugins
    await server.register(cors, {
      origin: [
        "https://mwenyeji.com",
        "https://www.mwenyeji.com",
        /^https:\/\/([a-z0-9-]+\.)*mwenyeji\.com$/, // any mwenyeji.com subdomain
        /^http:\/\/localhost(:\d+)?$/, // local development
        /^http:\/\/127\.0\.0\.1(:\d+)?$/,
      ],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      exposedHeaders: ["Content-Disposition"],
      credentials: true,
      preflight: true,
      strictPreflight: false,
    });

    // Helmet setup for security - register AFTER CORS
    await server.register(helmet, {
      global: true,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
      contentSecurityPolicy: false,
    });

    // Initialize Redis client (optional — the app must not depend on it to serve traffic)
    const redisClient = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD, // Leave empty if no password
      db: parseInt(process.env.REDIS_DB) || 0,
      keyPrefix: process.env.REDIS_KEY_PREFIX || "", // Use same prefix as microservice
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false, // fail fast instead of queueing commands forever
      lazyConnect: false,
      // Stop retrying after ~10 attempts with capped backoff; log once per retry
      retryStrategy: (times) => {
        if (times > 10) {
          console.error(
            "Redis unreachable after 10 attempts — giving up (app continues without Redis)",
          );
          return null; // stop reconnecting
        }
        return Math.min(times * 2000, 30000);
      },
    });

    let redisErrorLogged = false;
    redisClient.on("connect", () => {
      redisErrorLogged = false;
      console.log("Redis client connected");
      logger.info("Redis client connected");
    });

    redisClient.on("error", (err) => {
      // Log the first error, then stay quiet to avoid flooding Cloud Run logs
      if (!redisErrorLogged) {
        redisErrorLogged = true;
        console.error("Redis client error:", err.message);
        logger.error(`Redis client error: ${err.message}`);
      }
    });

    // Make Redis client available throughout the application
    server.decorate("redis", redisClient);

    // Register the static plugin to serve the "uploads" directory
    await server.register(fastifyStatic, {
      root: path.join(__dirname, "uploads"),
      prefix: "/uploads/", // Files will be served under this URL prefix
    });

    // Register multer content parser
    await server.register(multer.contentParser);

    // Metrics plugin registration
    await server.register(metricsPlugin, { endpoint: "/metrics" });

    // Error handling middleware
    server.setErrorHandler((error, request, reply) => {
      logger.error(`${error.message}`);
      reply.status(500).send({ error: "Internal Server Error" });
    });

    // Hook to log requests
    server.addHook("onRequest", (request, reply, done) => {
      request.startTime = new Date();
      apiLog(`[${request.method}] "${request.url}" - Request received`);
      done();
    });

    // Hook to log responses and calculate duration
    server.addHook("onResponse", (request, reply, done) => {
      const endTime = new Date();
      const duration = endTime - (request.startTime || endTime);
      const startTime =
        request.startTime instanceof Date ? request.startTime : new Date();
      const logEntry = {
        url: request.url,
        method: request.method,
        duration: duration,
        time: startTime,
        date: startTime.toISOString().split("T")[0],
      };
      addLog(logEntry);
      apiLog(
        `[${request.method}] "${request.url}" - Request duration: ${duration}ms`,
      );
      done();
    });

    // Register routes from different modules
    // const accountRoutes = require("./src/routes/accounts");
    const coreRoutes = require("./src/routes/core");
    const residentRoutes = require("./src/routes/resident");
    const errorRoutes = require("./src/routes/error");
    const authRoutes = require("./src/routes/auth");
    const appRoutes = require("./src/routes/app");
    const landlordRoutes = require("./src/routes/landlord");
    const maintenanceRoutes = require("./src/controllers/app/maintenance_management/routes/maintenance_routes");
    const facilityPaymentRoutes = require("./src/controllers/core/facility_management/facility_payment_details/routes/facility_payment.routes");
    const expenseRoutes = require("./src/controllers/app/expense_management/routes/expense_routes");
    const utilityRoutes = require("./src/controllers/core/utility_mnagement/routes/utility_routes");
    const powerMeterCoreRoutes = require("./src/controllers/core/power_meter_management/routes/power_meter_routes");
    const powerMeterAppRoutes = require("./src/controllers/app/power_meter_management/routes/power_meter_routes");
    const powerMeterResidentRoutes = require("./src/controllers/resident/utility_management/power_meter/routes/power_meter_routes");
    const procurementRoutes = require("./src/controllers/app/procurement_management/routes/procurement_routes");
    const utilityAppRoutes = require("./src/controllers/app/utility_management/routes/utility_routes");
    const utilityResidentRoutes = require("./src/controllers/resident/utility_management/water_meter/resident_utility_routes");
    const register_default_user = require("./src/controllers/authentication/register_default_user");
    const accountsRoutes = require("./src/controllers/app/accounts_gl/routes/gl.accounts.routes");
    const notificationRoutes = require("./src/controllers/notifications/routes");
    const walletRoutes = require("./src/controllers/wallet/routes");
    const universalRoutes = require("./src/controllers/universal/routes");
    const communicationsQueueRoutes = require("./src/controllers/core/settings/communication/routes");
    const registerBillingRoutes = require("./src/controllers/core/billing_manager/routes");
    const customerObsessionRoutes = require("./src/routes/customer_obsession");
    const moveInRoutes = require("./src/routes/move_in");
    const internalRoutes = require("./src/routes/internal");

    // ============================================================================
    // ZOHO BOOKS INTEGRATION
    // ============================================================================
    const {
      registerRoutes: registerZohoRoutes,
    } = require("./src/controllers/integrations/zoho/zoho_routes");

    authRoutes.registerRoutes(server);
    coreRoutes.registerRoutes(server);
    appRoutes.registerRoutes(server);
    errorRoutes.registerRoutes(server);
    residentRoutes.registerRoutes(server);
    landlordRoutes.registerRoutes(server);
    maintenanceRoutes.registerRoutes(server);
    expenseRoutes.registerRoutes(server);
    utilityRoutes.registerRoutes(server);
    powerMeterCoreRoutes.registerRoutes(server);
    powerMeterAppRoutes.registerRoutes(server);
    powerMeterResidentRoutes.registerRoutes(server);
    utilityAppRoutes.registerRoutes(server);
    utilityResidentRoutes.registerRoutes(server);
    procurementRoutes.registerRoutes(server);
    facilityPaymentRoutes.registerPaymentRoutes(server);
    accountsRoutes.registerAccountRoutes(server);
    notificationRoutes.registerRoutes(server);
    walletRoutes.registerRoutes(server);
    universalRoutes.registerRoutes(server);
    communicationsQueueRoutes.registerRoutes(server);
    registerBillingRoutes.registerRoutes(server);
    customerObsessionRoutes.registerRoutes(server);
    moveInRoutes.registerRoutes(server);
    internalRoutes.registerRoutes(server);

    // ============================================================================
    // ZOHO BOOKS INTEGRATION ROUTES
    // ============================================================================
    // Note: These routes do NOT require JWT authentication (service-to-service)
    // Protect at network/API gateway level in production
    try {
      await registerZohoRoutes(server);
      startEscalatedMetersCron();
      logger.info("✅ Zoho Books integration routes registered successfully");
      console.log(
        "✅ Zoho Books integration routes registered at /api/integrations/zoho",
      );
    } catch (error) {
      logger.error("❌ Failed to register Zoho Books routes:", error.message);
      console.error(
        "❌ Zoho Books integration routes failed to register:",
        error.message,
      );
      // Don't fail the entire app if Zoho routes fail to register
    }

    // Register default user (if needed)
    register_default_user();

    // Custom routes for URL shortener testing
    await server.register(async function (fastify) {
      // Test route for Redis
      fastify.get("/redis-test", async (request, reply) => {
        try {
          // Set a test value
          const testKey = "test:key";
          const testValue = "Hello Redis!";

          await redisClient.set(testKey, testValue);
          const result = await redisClient.get(testKey);

          return reply.send({
            success: true,
            message: "Redis is working",
            result: result,
          });
        } catch (error) {
          return reply.status(500).send({
            success: false,
            message: "Redis test failed",
            error: error.message,
          });
        }
      });

      // Test route to manually create a short URL
      fastify.get("/create-short-url-test", async (request, reply) => {
        try {
          const longUrl =
            request.query.url || "https://resident.payserve.co.ke";
          const code = request.query.code || "test123";

          // Create a Redis key
          const redisKey = `url:short:${code}`;

          // Store in Redis
          await redisClient.set(redisKey, longUrl);
          const ttl = 86400; // 1 day
          await redisClient.expire(redisKey, ttl);

          // Check if it was stored
          const storedUrl = await redisClient.get(redisKey);

          return reply.send({
            success: true,
            message: "Short URL created",
            code: code,
            longUrl: longUrl,
            shortUrl: `${request.protocol}://${request.hostname}/s/${code}`,
            storedUrl: storedUrl,
            ttl: ttl,
          });
        } catch (error) {
          return reply.status(500).send({
            success: false,
            message: "Failed to create short URL",
            error: error.message,
          });
        }
      });

      fastify.get("/test-redirect", async (request, reply) => {
        return reply.redirect(302, "https://resident.payserve.co.ke");
      });

      fastify.log.info("Registered URL shortener test routes");
    });

    // Test route
    server.get("/api", async (request, reply) => {
      reply.send({ Message: "Success" });
    });

    // Catch-all route to handle 404 - must be the last route
    server.setNotFoundHandler((request, reply) => {
      reply.redirect("/404-not-found");
    });

    // Start server and connect to MongoDB
    server.listen(
      { port: process.env.PORT || 3050, host: "0.0.0.0" },
      (err) => {
        if (err) {
          logger.error(`Error starting server: ${err.message}`);
          setTimeout(() => {
            process.exit(1); // Exit with an error code
          }, 500);
          return; // Exit the listener function early
        }
        // Connects directly via MONGODB_URI / MOVEIN_MONGODB_URI env vars
        payservedb
          .connectToMongoDB(process.env.DB_NAME || "payserve_property")
          .then(() =>
            payservedb.connectToMoveInDB(
              process.env.MOVEIN_DB_NAME || "payserve_movein",
            ),
          )
          .then(() => {
            logger.info("Connected to MongoDB");

            archiveOldLogs();

            // Only initialize in the first worker to avoid duplicate cron jobs
            if (cluster.worker.id === 1) {
              const overdueTicketScheduler = require("./src/controllers/customer_obsession/notifications/overdueTicketScheduler");
              overdueTicketScheduler.startCron();
              logger.info(
                `Overdue ticket scheduler initialized in worker ${cluster.worker.id}`,
              );

              const autoReplyScheduler = require("./src/controllers/customer_obsession/notifications/autoReplyScheduler");
              autoReplyScheduler.startCron();
              logger.info(
                `Auto-reply scheduler initialized in worker ${cluster.worker.id}`,
              );

              const moveInCleanup = require("./src/jobs/move_in_cleanup");
              moveInCleanup.startCron();
              logger.info(
                `Move-In cleanup scheduler initialized in worker ${cluster.worker.id}`,
              );
            }
          })
          .catch((error) => {
            logger.error(`MongoDB connection failed: ${error.message}`);
            process.exit(1); // Exit on MongoDB failure
          });

        const message = `Worker ${process.pid}: Backend API Server is listening on port ${process.env.PORT}: http://localhost:${process.env.PORT}`;
        logger.info(message);
        console.log(message);
      },
    );
  })().catch((err) => {
    console.error("Failed to start worker:", err);
    process.exit(1);
  });
}
