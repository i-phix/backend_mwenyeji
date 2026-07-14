const getNotifications = require("../controllers/notifications/get_notifications");
const markRead = require("../controllers/notifications/mark_read");
const markAllRead = require("../controllers/notifications/mark_all_read");
const { authenticate } = require("../middlewares/authenticate");

// Shared across tenant/landlord/admin — role is read off the JWT, not the route.
async function notificationsRoutes(fastify) {
  const opts = { preHandler: [authenticate] };

  fastify.get("/api/move_in/notifications", opts, getNotifications);
  fastify.put("/api/move_in/notifications/read/:notifId", opts, markRead);
  fastify.put("/api/move_in/notifications/read_all", opts, markAllRead);
}

module.exports = notificationsRoutes;
