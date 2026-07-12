const Conversation = require("../../models/Conversation");

// GET /api/move_in/messaging/conversations — authenticated tenant
async function getMyConversations(request, reply) {
  try {
    const conversations = await Conversation.find({ tenantId: request.user.userId })
      .populate("landlordId", "fullName companyName")
      .populate("unitId", "title")
      .sort({ updatedAt: -1 })
      .lean();

    const data = conversations.map((c) => ({
      ...c,
      landlordName: c.landlordId?.companyName || c.landlordId?.fullName || "Landlord",
      landlordId: c.landlordId?._id || c.landlordId,
      unitName: c.unitId?.title || "Unit",
      unitId: c.unitId?._id || c.unitId,
    }));

    return reply.code(200).send({ success: true, data });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getMyConversations;
