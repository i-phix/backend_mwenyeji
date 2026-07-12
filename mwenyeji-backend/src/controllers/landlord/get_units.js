const Unit = require("../../models/Unit");

// GET /api/move_in/landlord/units — authenticated landlord, their own units
async function getUnits(request, reply) {
  try {
    const units = await Unit.find({ landlordId: request.user.userId })
      .sort({ createdAt: -1 })
      .lean();

    return reply.code(200).send({ success: true, data: units });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getUnits;
