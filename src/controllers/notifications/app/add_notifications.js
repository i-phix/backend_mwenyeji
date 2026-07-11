const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

const add_facility_notifications = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { userId, message } = request.body;

    const Notification = await getModel(
      "Notification",
      payservedb.Notification.schema,
      facilityId,
    );

    // Server automatically sets dateSent to current date/time
    const notification = await Notification.create({
      userId,
      facilityId,
      message,
      dateSent: new Date(), // Auto-generated on server
    });

    return reply.code(200).send({
      message: "Notification added successfully",
      notification,
    });
  } catch (error) {
    console.error(`Error creating notification: ${error}`);
    return reply.code(500).send({
      message: "Internal server error",
    });
  }
};

const mark_notification_as_read = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { notificationId } = request.body;

    const Notification = await getModel(
      "Notification",
      payservedb.Notification.schema,
      facilityId,
    );

    // Server automatically sets dateUpdated and dateRead to current date/time
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId },
      {
        read: true,
        dateUpdated: new Date(), // Auto-generated on server
        dateRead: new Date(), // Auto-generated on server
      },
      { new: true }, // Return the updated document
    );

    return reply.code(200).send({
      message: "Notification marked as read successfully",
      notification,
    });
  } catch (error) {
    console.error(`Error marking notification as read: ${error}`);
    return reply.code(500).send({
      message: "Internal server error",
    });
  }
};

module.exports = {
  add_facility_notifications,
  mark_notification_as_read,
};
