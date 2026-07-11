const authenticateJWT = require("../middlewares/jwt_authentication");
const communicationRoutes = require("../controllers/core/settings/communication/routes");

async function registerRoutes(fastify) {
  // Register email and SMS queue routes
  await communicationRoutes.registerRoutes(fastify);

  // You can add more communication-specific routes here
}

module.exports = { registerRoutes };
