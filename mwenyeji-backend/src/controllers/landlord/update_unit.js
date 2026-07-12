const Unit = require("../../models/Unit");

const EDITABLE_FIELDS = [
  "title", "description", "listingType", "unitType", "price", "bedrooms",
  "bathrooms", "grossArea", "images", "amenities", "nearbyServices",
  "location", "isListed", "status",
];

// PUT /api/move_in/landlord/units/:unitId — authenticated landlord, own unit only
// Edits re-queue the unit for approval, same as creation — keeps the admin
// moderation gate meaningful instead of a one-time check.
async function updateUnit(request, reply) {
  try {
    const { unitId } = request.params;
    const unit = await Unit.findOne({ _id: unitId, landlordId: request.user.userId });
    if (!unit) return reply.code(404).send({ error: "Listing not found" });

    for (const field of EDITABLE_FIELDS) {
      if (request.body?.[field] !== undefined) {
        unit[field] = request.body[field];
      }
    }
    unit.approvalStatus = "pending";
    await unit.save();

    return reply.code(200).send({ success: true, data: unit });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = updateUnit;
