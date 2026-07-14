const Unit = require("../../models/Unit");
const Conversation = require("../../models/Conversation");

// POST /api/move_in/messaging/conversations — authenticated tenant
// Body: { unitId } or { landlordId } — finds an existing conversation with
// that landlord (scoped to the unit if given) or creates a new one.
async function startConversation(request, reply) {
  try {
    const { unitId, landlordId } = request.body || {};
    let resolvedLandlordId = landlordId;

    if (unitId) {
      const unit = await Unit.findById(unitId).select("landlordId");
      if (!unit) return reply.code(404).send({ error: "Listing not found" });
      resolvedLandlordId = unit.landlordId;
    }
    if (!resolvedLandlordId) return reply.code(400).send({ error: "unitId or landlordId is required" });

    let conversation = await Conversation.findOne({
      tenantId: request.user.userId,
      landlordId: resolvedLandlordId,
      unitId: unitId || undefined,
    });
    if (!conversation) {
      conversation = await new Conversation({
        tenantId: request.user.userId,
        landlordId: resolvedLandlordId,
        unitId: unitId || undefined,
      }).save();
    }

    return reply.code(201).send({ success: true, data: conversation });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = startConversation;
