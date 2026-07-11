const send_whatsapp = require('../controllers/internal/notifications/send_whatsapp');

/**
 * Internal service-to-service routes.
 *
 * These endpoints are NOT for end users. They are intended for sibling
 * Node services (water_meter_service, water_billing_service, etc.) that
 * need to reuse logic that lives in the main backend.
 *
 * All routes are prefixed with /api/internal and authenticated via a
 * shared Bearer token (INTERNAL_SERVICE_TOKEN). Protect at the network
 * layer in production.
 */
async function registerRoutes(fastify) {
  const base = '/api/internal';

  fastify.post(base + '/notifications/whatsapp', send_whatsapp);
}

module.exports = { registerRoutes };
