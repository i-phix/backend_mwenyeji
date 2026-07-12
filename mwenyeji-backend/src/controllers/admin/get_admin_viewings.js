const Booking = require("../../models/Booking");
const { matchesDay, matchesDate, matchesSearch, sortUpcoming } = require("../../utils/workflowFilters");

// GET /api/core/move_in/viewings — authenticated admin
async function getAdminViewings(request, reply) {
  try {
    const { status, search, day, date } = request.query || {};

    const filter = {};
    if (status && status !== "All") filter.status = status;

    const bookings = await Booking.find(filter)
      .populate("unitId", "title")
      .populate("landlordId", "fullName companyName")
      .populate("tenantId", "fullName email phoneNumber")
      .sort({ scheduledDate: 1 })
      .lean();

    let list = bookings.map((b) => ({
      ...b,
      unitName: b.unitId?.title || b.unitName || "Unit",
      unitId: b.unitId?._id || b.unitId,
      landlordName: b.landlordId?.companyName || b.landlordId?.fullName || "",
      tenantName: b.tenantId?.fullName || b.guest?.fullName || "Tenant",
      tenantEmail: b.tenantId?.email || b.guest?.email || "",
    }));

    list = list.filter(
      (b) =>
        matchesSearch(b, [b.tenantName, b.unitName, b.tenantEmail, b.landlordName], search) &&
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

module.exports = getAdminViewings;
