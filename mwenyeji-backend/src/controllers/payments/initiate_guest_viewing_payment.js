const { initiatePayment } = require("./initiate_viewing_payment");

// POST /api/move_in/viewings/initiate-payment/guest — no auth required
async function initiateGuestViewingPayment(request, reply) {
  try {
    const { phone, fullName, email } = request.body || {};
    if (!phone) return reply.code(400).send({ error: "phone is required" });
    if (!fullName || !email) return reply.code(400).send({ error: "fullName and email are required" });

    const data = await initiatePayment(request.body, {
      guest: { fullName, email, phoneNumber: phone },
    });
    return reply.code(201).send({ success: true, data });
  } catch (err) {
    if (err.status) return reply.code(err.status).send({ error: err.message });
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = initiateGuestViewingPayment;
