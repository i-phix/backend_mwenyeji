const Unit = require("../../models/Unit");
const { logAdminAction } = require("../../utils/audit");

// POST /api/core/move_in/listings/approve — authenticated admin, body: { unitId }
async function approveListing(request, reply) {
  try {
    const { unitId } = request.body || {};
    const unit = await Unit.findByIdAndUpdate(
      unitId,
      { approvalStatus: "approved", rejectionReason: undefined },
      { new: true },
    );
    if (!unit) return reply.code(404).send({ error: "Listing not found" });

    await logAdminAction(request, { action: "approve_listing", resourceType: "Unit", resourceId: unit._id, details: unit.title });

    return reply.code(200).send({ success: true, data: unit });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = approveListing;
