const Booking = require("../../models/Booking");
const { matchesDay, matchesDate, matchesSearch, sortUpcoming } = require("../../utils/workflowFilters");

// GET /api/move_in/landlord/viewings/bookings — authenticated landlord
// Query: status, search, day, date, sort=upcoming
async function getLandlordBookings(request, reply) {
  try {
    const { status, search, day, date } = request.query || {};

    const filter = { landlordId: request.user.userId };
    if (status && status !== "All") filter.status = status;

    const bookings = await Booking.find(filter)
      .populate("unitId", "title")
      .populate("tenantId", "fullName email phoneNumber")
      .sort({ scheduledDate: 1 })
      .lean();

    let list = bookings.map((b) => ({
      ...b,
      unitName: b.unitId?.title || b.unitName || "Unit",
      unitId: b.unitId?._id || b.unitId,
      tenantName: b.tenantId?.fullName || b.guest?.fullName || "Tenant",
      tenantEmail: b.tenantId?.email || b.guest?.email || "",
      tenantPhone: b.tenantId?.phoneNumber || b.guest?.phoneNumber || "",
    }));

    list = list.filter(
      (b) =>
        matchesSearch(b, [b.tenantName, b.unitName, b.tenantEmail], search) &&
        matchesDay(b.scheduledDate, day) &&
        matchesDate(b.scheduledDate, date),
    );
    list = sortUpcoming(list, "scheduledDate");

    return reply.code(200).send({ success: true, data: list });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getLandlordBookings;
