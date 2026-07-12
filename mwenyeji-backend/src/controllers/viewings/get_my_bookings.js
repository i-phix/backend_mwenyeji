const Booking = require("../../models/Booking");

// GET /api/move_in/viewing/bookings — authenticated tenant
async function getMyBookings(request, reply) {
  try {
    const bookings = await Booking.find({ tenantId: request.user.userId })
      .populate("unitId", "title location")
      .populate("landlordId", "fullName companyName")
      .sort({ scheduledDate: 1 })
      .lean();

    const data = bookings.map((b) => ({
      ...b,
      unitName: b.unitId?.title || b.unitName || "Unit",
      unitId: b.unitId?._id || b.unitId,
      landlordName: b.landlordId?.companyName || b.landlordId?.fullName || undefined,
      landlordId: b.landlordId?._id || b.landlordId,
      location: b.unitId?.location ? [b.unitId.location.area, b.unitId.location.city].filter(Boolean).join(", ") : undefined,
    }));

    return reply.code(200).send({ success: true, data });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getMyBookings;
