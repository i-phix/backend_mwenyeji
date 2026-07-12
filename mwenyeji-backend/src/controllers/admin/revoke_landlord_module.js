const Landlord = require("../../models/Landlord");
const { logAdminAction } = require("../../utils/audit");

// PUT /api/core/move_in/landlords/revoke/:id — authenticated admin
async function revokeLandlordModule(request, reply) {
  try {
    const { id } = request.params;
    const landlord = await Landlord.findByIdAndUpdate(id, { status: "suspended" }, { new: true });
    if (!landlord) return reply.code(404).send({ error: "Landlord not found" });

    await logAdminAction(request, { action: "revoke_landlord_module", resourceType: "Landlord", resourceId: landlord._id, details: landlord.email });

    return reply.code(200).send({ success: true, data: landlord });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = revokeLandlordModule;
