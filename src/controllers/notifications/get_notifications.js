const Notification = require("../../models/Notification");
const { recipientTypeFor } = require("../../utils/recipientType");

// GET /api/move_in/notifications — authenticated (tenant|landlord|admin)
// Query: page, limit (both optional). The header bell paginates (limit=5);
// the full notifications page fetches without params and expects the
// (near-)complete list back, so default to a generous limit when the
// caller doesn't specify one.
async function getNotifications(request, reply) {
  try {
    const recipientType = recipientTypeFor(request.user.role);
    const recipientId = request.user.userId;

    const page = Math.max(1, Number(request.query?.page) || 1);
    const limit = Number(request.query?.limit) || 100;
    const skip = (page - 1) * limit;

    const filter = { recipientType, recipientId };
    const [items, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, isRead: false }),
    ]);

    return reply.code(200).send({
      success: true,
      data: items,
      unreadCount,
      pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getNotifications;
