const Conversation = require("../../models/Conversation");

// GET /api/move_in/landlord/messaging/conversations — authenticated landlord
async function getLandlordConversations(request, reply) {
  try {
    const conversations = await Conversation.find({ landlordId: request.user.userId })
      .populate("tenantId", "fullName")
      .populate("unitId", "title")
      .sort({ updatedAt: -1 })
      .lean();

    const data = conversations.map((c) => ({
      ...c,
      tenantName: c.tenantId?.fullName || "Tenant",
      tenantId: c.tenantId?._id || c.tenantId,
      unitName: c.unitId?.title || "Unit",
      unitId: c.unitId?._id || c.unitId,
    }));

    return reply.code(200).send({ success: true, data });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getLandlordConversations;
