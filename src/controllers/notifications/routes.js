const authenticateJWT = require("../../middlewares/jwt_authentication");

const notificationBaseRoute = "/api/app/notifications";

const addNotification = require("./app/add_notifications");
const getNotifications = require("./app/get_notifications");

async function registerRoutes(fastify) {
  const jwt = { prehandler: authenticateJWT };

  fastify.post(
    `${notificationBaseRoute}/add/:facilityId`,
    jwt,
    addNotification.add_facility_notifications,
  );
  fastify.patch(
    `${notificationBaseRoute}/mark/:facilityId`,
    jwt,
    addNotification.mark_notification_as_read,
  );

  fastify.get(
    `${notificationBaseRoute}/:facilityId`,
    jwt,
    getNotifications.get_facility_notifications,
  );

  fastify.get(
    `${notificationBaseRoute}/get_by_id/:facilityId/:notificationId`,
    jwt,
    getNotifications.get_notifications_by_id,
  );

  fastify.get(
    `${notificationBaseRoute}/get_all_unread/:userId/:facilityId`,
    jwt,
    getNotifications.get_user_unread_notifications,
  );
}

module.exports = {
  registerRoutes,
};
