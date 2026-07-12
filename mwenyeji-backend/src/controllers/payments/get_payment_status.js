const Payment = require("../../models/Payment");

// GET /api/move_in/payments/:accountNumber/status — public
// Polled by the frontend every few seconds while an STK push is pending.
async function getPaymentStatus(request, reply) {
  try {
    const { accountNumber } = request.params;
    const payment = await Payment.findOne({ accountNumber }).select("status amount currency purpose failureReason");
    if (!payment) return reply.code(404).send({ error: "Payment not found" });

    return reply.code(200).send({ success: true, data: payment });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getPaymentStatus;
