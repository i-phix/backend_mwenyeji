require("dotenv").config();
const Fastify = require("fastify");
const cors = require("@fastify/cors");
const helmet = require("@fastify/helmet");
const multipart = require("@fastify/multipart");

const { connectDB } = require("./src/config/db");
const authRoutes = require("./src/routes/auth.routes");
const listingsRoutes = require("./src/routes/listings.routes");
const applicationsRoutes = require("./src/routes/applications.routes");
const viewingsRoutes = require("./src/routes/viewings.routes");
const reservationsRoutes = require("./src/routes/reservations.routes");
const tenancyRoutes = require("./src/routes/tenancy.routes");
const paymentsRoutes = require("./src/routes/payments.routes");
const notificationsRoutes = require("./src/routes/notifications.routes");
const messagingRoutes = require("./src/routes/messaging.routes");
const profileRoutes = require("./src/routes/profile.routes");
const preferencesRoutes = require("./src/routes/preferences.routes");
const landlordRoutes = require("./src/routes/landlord.routes");
const adminRoutes = require("./src/routes/admin.routes");
const chatRoutes = require("./src/routes/chat");

async function start() {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
    },
    trustProxy: true,
  });

  const allowedOrigins = (
    process.env.ALLOWED_ORIGINS ||
    "https://mwenyeji.com,https://www.mwenyeji.com"
  )
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  await fastify.register(cors, {
    origin: [
      ...allowedOrigins,
      /^http:\/\/localhost(:\d+)?$/,
      /^http:\/\/127\.0\.0\.1(:\d+)?$/,
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
  });

  await fastify.register(helmet, {
    global: true,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  });

  await fastify.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB — plenty for a lease PDF
  });

  await connectDB();
  await fastify.register(chatRoutes);

  await fastify.register(authRoutes);
  await fastify.register(listingsRoutes);
  await fastify.register(applicationsRoutes);
  await fastify.register(viewingsRoutes);
  await fastify.register(reservationsRoutes);
  await fastify.register(tenancyRoutes);
  await fastify.register(paymentsRoutes);
  await fastify.register(notificationsRoutes);
  await fastify.register(messagingRoutes);
  await fastify.register(profileRoutes);
  await fastify.register(preferencesRoutes);
  await fastify.register(landlordRoutes);
  await fastify.register(adminRoutes);

  fastify.get("/health", async () => ({ status: "ok" }));

  fastify.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ error: "Not found" });
  });

  const port = process.env.PORT || 3050;
  await fastify.listen({ port, host: "0.0.0.0" });
  fastify.log.info(`Mwenyeji backend listening on :${port}`);
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
