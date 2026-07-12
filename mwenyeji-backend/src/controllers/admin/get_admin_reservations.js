const Reservation = require("../../models/Reservation");
const { matchesDay, matchesDate, matchesSearch, sortUpcoming } = require("../../utils/workflowFilters");

// GET /api/core/move_in/reservations — authenticated admin
async function getAdminReservations(request, reply) {
  try {
    const { status, search, day, date } = request.query || {};

    const filter = {};
    if (status && status !== "All") filter.status = status;

    const reservations = await Reservation.find(filter)
      .populate("unitId", "title")
      .populate("landlordId", "fullName companyName")
      .populate("tenantId", "fullName email phoneNumber")
      .sort({ createdAt: -1 })
      .lean();

    let list = reservations.map((r) => ({
      ...r,
      unitName: r.unitId?.title || r.unitName || "Unit",
      unitId: r.unitId?._id || r.unitId,
      landlordName: r.landlordId?.companyName || r.landlordId?.fullName || "",
      tenantName: r.tenantId?.fullName || r.guest?.fullName || "Prospect",
      tenantEmail: r.tenantId?.email || r.guest?.email || "",
    }));

    list = list.filter(
      (r) =>
        matchesSearch(r, [r.tenantName, r.unitName, r.tenantEmail, r.landlordName], search) &&
        matchesDay(r.desiredMoveInDate, day) &&
        matchesDate(r.desiredMoveInDate, date),
    );
    list = sortUpcoming(list, "desiredMoveInDate");

    return reply.code(200).send({ success: true, data: list });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getAdminReservations;
