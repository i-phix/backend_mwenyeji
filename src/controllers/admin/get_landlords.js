const Landlord = require("../../models/Landlord");

// GET /api/core/move_in/landlords — authenticated admin
// Standalone Mwenyeji has no separate "module" grant — every landlord
// already has full access once active. isEnabled is derived from status.
async function getLandlords(request, reply) {
  try {
    const landlords = await Landlord.find().select("-password").sort({ createdAt: -1 }).lean();

    const data = landlords.map((l) => ({
      ...l,
      landlordId: l._id,
      isEnabled: l.status === "active",
    }));

    return reply.code(200).send({ success: true, data });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getLandlords;
