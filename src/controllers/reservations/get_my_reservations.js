const Reservation = require("../../models/Reservation");

// GET /api/move_in/reservations — authenticated tenant
async function getMyReservations(request, reply) {
  try {
    const reservations = await Reservation.find({ tenantId: request.user.userId })
      .populate("unitId", "title")
      .sort({ createdAt: -1 })
      .lean();

    const data = reservations.map((r) => ({
      ...r,
      unitName: r.unitId?.title || r.unitName || "Unit",
      unitId: r.unitId?._id || r.unitId,
    }));

    return reply.code(200).send({ success: true, data });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getMyReservations;
