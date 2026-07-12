const { createBooking } = require("./book_slot");

// POST /api/move_in/viewing/book_guest — no auth required
async function bookGuestSlot(request, reply) {
  try {
    const { fullName, email, phoneNumber } = request.body || {};
    if (!fullName || !email || !phoneNumber) {
      return reply.code(400).send({ error: "fullName, email and phoneNumber are required" });
    }
    const booking = await createBooking(request.body, { guest: { fullName, email, phoneNumber } });
    return reply.code(201).send({ success: true, data: booking });
  } catch (err) {
    if (err.status) return reply.code(err.status).send({ error: err.message });
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = bookGuestSlot;
