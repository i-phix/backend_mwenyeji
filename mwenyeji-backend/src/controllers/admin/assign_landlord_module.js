const Landlord = require("../../models/Landlord");
const { logAdminAction } = require("../../utils/audit");

// POST /api/core/move_in/landlords/assign — authenticated admin
// Body: { landlordId } — activates an existing landlord account (every
// landlord already has full platform access once active; there's no
// separate module to grant in the standalone build).
async function assignLandlordModule(request, reply) {
  try {
    const { landlordId } = request.body || {};
    if (!landlordId) return reply.code(400).send({ error: "landlordId is required" });

    const landlord = await Landlord.findById(landlordId.trim());
    if (!landlord) return reply.code(404).send({ error: "Landlord not found" });

    landlord.status = "active";
    landlord.assignedAt = landlord.assignedAt || new Date();
    await landlord.save();

    await logAdminAction(request, { action: "assign_landlord_module", resourceType: "Landlord", resourceId: landlord._id, details: landlord.email });

    return reply.code(200).send({ success: true, message: `Module assigned to ${landlord.fullName}`, data: landlord });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = assignLandlordModule;
