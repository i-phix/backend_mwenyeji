const Notification = require("../../models/Notification");
const { recipientTypeFor } = require("../../utils/recipientType");

// PUT /api/move_in/notifications/read_all — authenticated
async function markAllRead(request, reply) {
  try {
    await Notification.updateMany(
      { recipientType: recipientTypeFor(request.user.role), recipientId: request.user.userId, isRead: false },
      { isRead: true },
    );
    return reply.code(200).send({ success: true });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = markAllRead;
