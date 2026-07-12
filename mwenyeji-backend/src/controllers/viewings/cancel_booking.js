const Booking = require("../../models/Booking");
const ViewingSlot = require("../../models/ViewingSlot");

// PUT /api/move_in/viewing/bookings/cancel/:id — authenticated tenant
async function cancelBooking(request, reply) {
  try {
    const { id } = request.params;
    const booking = await Booking.findOne({ _id: id, tenantId: request.user.userId });
    if (!booking) return reply.code(404).send({ error: "Booking not found" });
    if (booking.status === "cancelled") return reply.code(200).send({ success: true, data: booking });

    booking.status = "cancelled";
    await booking.save();

    if (booking.slotId) {
      await ViewingSlot.findByIdAndUpdate(booking.slotId, { $inc: { bookedCount: -1 } });
    }

    return reply.code(200).send({ success: true, data: booking });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = cancelBooking;
