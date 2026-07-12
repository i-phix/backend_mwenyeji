const Unit = require("../../models/Unit");
const { logAdminAction } = require("../../utils/audit");

// POST /api/core/move_in/listings/reject — authenticated admin, body: { unitId, reason }
async function rejectListing(request, reply) {
  try {
    const { unitId, reason } = request.body || {};
    const unit = await Unit.findByIdAndUpdate(
      unitId,
      { approvalStatus: "rejected", rejectionReason: reason || "" },
      { new: true },
    );
    if (!unit) return reply.code(404).send({ error: "Listing not found" });

    await logAdminAction(request, { action: "reject_listing", resourceType: "Unit", resourceId: unit._id, details: reason || "" });

    return reply.code(200).send({ success: true, data: unit });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = rejectListing;
