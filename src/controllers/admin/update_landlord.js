const Landlord = require("../../models/Landlord");
const { logAdminAction } = require("../../utils/audit");

// PUT /api/core/move_in/landlords/:id — authenticated admin
async function updateLandlord(request, reply) {
  try {
    const { id } = request.params;
    const { fullName, email, phoneNumber } = request.body || {};

    const landlord = await Landlord.findById(id);
    if (!landlord) return reply.code(404).send({ error: "Landlord not found" });

    if (fullName !== undefined) landlord.fullName = fullName;
    if (email !== undefined) landlord.email = email.toLowerCase().trim();
    if (phoneNumber !== undefined) landlord.phoneNumber = phoneNumber;
    await landlord.save();

    await logAdminAction(request, { action: "update_landlord", resourceType: "Landlord", resourceId: landlord._id, details: landlord.email });

    return reply.code(200).send({ success: true, data: landlord });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = updateLandlord;
