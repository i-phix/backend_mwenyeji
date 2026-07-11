const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

const get_facility_notifications = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    const Notification = await getModel(
      "Notification",
      payservedb.Notification.schema,
      facilityId,
    );

    const notifications = await Notification.find({
      facilityId,
    });

    reply.send({ success: true, notifications });
  } catch (error) {
    reply.status(500).send({ error: error.message });
  }
};

const get_user_unread_notifications = async (request, reply) => {
  try {
    const { userId, facilityId } = request.params;

    const Notification = await getModel(
      "Notification",
      payservedb.Notification.schema,
      facilityId,
    );

    const notifications = await Notification.find({
      userId,
      read: false,
    });

    reply.send({ success: true, notifications });
  } catch (error) {
    reply.status(500).send({ error: error.message });
  }
};

const get_notifications_by_id = async (request, reply) => {
  try {
    const { facilityId, notificationId } = request.params;

    const Notification = await getModel(
      "Notification",
      payservedb.Notification.schema,
      facilityId,
    );

    const notification = await Notification.findById(notificationId);

    reply.send({ success: true, notification });
  } catch (error) {
    reply.status(500).send({ error: error.message });
  }
};

const get_user_notifications = async (request, reply) => {
  try {
    const { userId, facilityId } = request.params;

    const Notification = await getModel(
      "Notification",
      payservedb.Notification.schema,
      facilityId,
    );

    const notifications = await Notification.find({
      userId,
    });

    reply.send({ success: true, notifications });
  } catch (error) {
    reply.status(500).send({ error: error.message });
  }
};

module.exports = {
  get_facility_notifications,
  get_user_unread_notifications,
  get_notifications_by_id,
  get_user_notifications,
};
