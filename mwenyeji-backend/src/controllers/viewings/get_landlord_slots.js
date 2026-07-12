const ViewingSlot = require("../../models/ViewingSlot");

// GET /api/move_in/landlord/viewings/slots — authenticated landlord
async function getLandlordSlots(request, reply) {
  try {
    const slots = await ViewingSlot.find({ landlordId: request.user.userId, status: "active" })
      .populate("unitId", "title")
      .sort({ date: 1, time: 1 })
      .lean();

    const data = slots.map((s) => ({
      ...s,
      unitName: s.unitId?.title || "Unit",
      unitId: s.unitId?._id || s.unitId,
      isAvailable: s.bookedCount < s.capacity,
    }));

    return reply.code(200).send({ success: true, data });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getLandlordSlots;
