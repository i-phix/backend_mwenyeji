const { makeReservation } = require("./create_reservation");

// POST /api/move_in/reservations/guest — no auth required
async function createGuestReservation(request, reply) {
  try {
    const { fullName, email, phoneNumber } = request.body || {};
    if (!fullName || !email || !phoneNumber) {
      return reply.code(400).send({ error: "fullName, email and phoneNumber are required" });
    }
    const reservation = await makeReservation(request.body, {
      guest: { fullName, email, phoneNumber },
      isGuest: true,
    });
    return reply.code(201).send({ success: true, data: reservation });
  } catch (err) {
    if (err.status) return reply.code(err.status).send({ error: err.message });
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = createGuestReservation;
