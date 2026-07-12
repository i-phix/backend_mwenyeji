const bcrypt = require("bcryptjs");
const Landlord = require("../../models/Landlord");
const { logAdminAction } = require("../../utils/audit");

function generateTempPassword() {
  return `Mv${Math.random().toString(36).slice(2, 8)}!${Math.floor(Math.random() * 90 + 10)}`;
}

// PUT /api/core/move_in/landlords/reset_password/:id — authenticated admin
async function resetLandlordPassword(request, reply) {
  try {
    const { id } = request.params;
    const landlord = await Landlord.findById(id);
    if (!landlord) return reply.code(404).send({ error: "Landlord not found" });

    const tempPassword = generateTempPassword();
    landlord.password = await bcrypt.hash(tempPassword, 10);
    await landlord.save();

    await logAdminAction(request, { action: "reset_landlord_password", resourceType: "Landlord", resourceId: landlord._id, details: landlord.email });

    return reply.code(200).send({ success: true, data: { tempPassword } });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = resetLandlordPassword;
