const Reservation = require("../../models/Reservation");

// PUT /api/move_in/reservations/cancel/:id — authenticated tenant
async function cancelReservation(request, reply) {
  try {
    const { id } = request.params;
    const reservation = await Reservation.findOne({ _id: id, tenantId: request.user.userId });
    if (!reservation) return reply.code(404).send({ error: "Reservation not found" });

    reservation.status = "cancelled";
    await reservation.save();

    return reply.code(200).send({ success: true, data: reservation });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = cancelReservation;
