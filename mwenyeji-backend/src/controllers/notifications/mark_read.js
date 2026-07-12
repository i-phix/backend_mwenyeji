const Notification = require("../../models/Notification");
const { recipientTypeFor } = require("../../utils/recipientType");

// PUT /api/move_in/notifications/read/:notifId — authenticated
async function markRead(request, reply) {
  try {
    const { notifId } = request.params;
    const notif = await Notification.findOneAndUpdate(
      { _id: notifId, recipientType: recipientTypeFor(request.user.role), recipientId: request.user.userId },
      { isRead: true },
      { new: true },
    );
    if (!notif) return reply.code(404).send({ error: "Notification not found" });

    return reply.code(200).send({ success: true, data: notif });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = markRead;
