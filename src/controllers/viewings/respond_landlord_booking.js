const Booking = require("../../models/Booking");

// PUT /api/move_in/landlord/viewings/bookings/:bookingId — authenticated landlord
// Body: { action: 'accept' | 'reschedule' | 'email' | 'cancel', scheduledDate?, scheduledTime?, message? }
async function respondLandlordBooking(request, reply) {
  try {
    const { bookingId } = request.params;
    const { action, scheduledDate, scheduledTime, message } = request.body || {};
    if (!["accept", "reschedule", "email", "cancel"].includes(action)) {
      return reply.code(400).send({ error: "Invalid action" });
    }

    const booking = await Booking.findOne({ _id: bookingId, landlordId: request.user.userId });
    if (!booking) return reply.code(404).send({ error: "Booking not found" });

    if (action === "accept") {
      booking.status = "confirmed";
    } else if (action === "cancel") {
      booking.status = "cancelled";
    } else if (action === "reschedule") {
      if (!scheduledDate || !scheduledTime) {
        return reply.code(400).send({ error: "scheduledDate and scheduledTime are required" });
      }
      booking.scheduledDate = scheduledDate;
      booking.scheduledTime = scheduledTime;
      booking.status = "confirmed";
    }
    // 'email' sends a note only — no status change. Actual email delivery
    // is wired up alongside the rest of notifications in a later phase;
    // for now the message is stored on the booking for visibility.

    if (message) booking.landlordMessage = message;
    await booking.save();

    return reply.code(200).send({ success: true, data: booking });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = respondLandlordBooking;
