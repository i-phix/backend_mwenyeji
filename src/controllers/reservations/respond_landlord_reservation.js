const Reservation = require("../../models/Reservation");
const Unit = require("../../models/Unit");
const createTenancy = require("../shared/create_tenancy");

// PUT /api/move_in/landlord/reservations/:reservationId — authenticated landlord
// Body: { action: 'accept' | 'reschedule' | 'email' | 'cancel' | 'rent', desiredMoveInDate?, message? }
async function respondLandlordReservation(request, reply) {
  try {
    const { reservationId } = request.params;
    const { action, desiredMoveInDate, message } = request.body || {};
    if (!["accept", "reschedule", "email", "cancel", "rent"].includes(action)) {
      return reply.code(400).send({ error: "Invalid action" });
    }

    const reservation = await Reservation.findOne({ _id: reservationId, landlordId: request.user.userId });
    if (!reservation) return reply.code(404).send({ error: "Reservation not found" });

    if (action === "accept") {
      reservation.status = "confirmed";
    } else if (action === "cancel") {
      reservation.status = "cancelled";
    } else if (action === "reschedule") {
      if (!desiredMoveInDate) return reply.code(400).send({ error: "desiredMoveInDate is required" });
      reservation.desiredMoveInDate = desiredMoveInDate;
    } else if (action === "rent") {
      if (reservation.status !== "confirmed") {
        return reply.code(400).send({ error: "Only confirmed reservations can be marked as rented" });
      }
      const unit = await Unit.findById(reservation.unitId);
      await createTenancy({
        reservationId: reservation._id,
        unitId: reservation.unitId,
        landlordId: reservation.landlordId,
        tenantId: reservation.tenantId || undefined,
        unitName: unit?.title,
      });
      reservation.status = "rented";
    }
    // 'email' sends a note only — see respond_landlord_booking.js for why.

    if (message) reservation.landlordNote = message;
    reservation.respondedAt = new Date();
    await reservation.save();

    return reply.code(200).send({ success: true, data: reservation });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = respondLandlordReservation;
