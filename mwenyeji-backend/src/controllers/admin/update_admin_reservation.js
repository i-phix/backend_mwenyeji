const Reservation = require("../../models/Reservation");

// PUT /api/core/move_in/reservations/:id — authenticated admin
// Body: { status?, adminNote? } — admin override, separate from the
// landlord's own accept/reject/cancel/rent actions.
async function updateAdminReservation(request, reply) {
  try {
    const { id } = request.params;
    const { status, adminNote } = request.body || {};

    const reservation = await Reservation.findById(id);
    if (!reservation) return reply.code(404).send({ error: "Reservation not found" });

    if (status) reservation.status = status;
    if (adminNote !== undefined) reservation.adminNote = adminNote;
    await reservation.save();

    return reply.code(200).send({ success: true, data: reservation });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = updateAdminReservation;
