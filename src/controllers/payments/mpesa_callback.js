const Payment = require("../../models/Payment");
const applyPaymentSuccess = require("./apply_payment_success");

// POST /api/move_in/payments/mpesa/callback — public (Safaricom webhook)
// Must always respond 200 with {ResultCode:0} or Safaricom will keep
// retrying the same callback. Any real problem gets logged instead of
// surfaced as an HTTP error to Safaricom.
async function mpesaCallback(request, reply) {
  const ack = { ResultCode: 0, ResultDesc: "Accepted" };
  try {
    const stkCallback = request.body?.Body?.stkCallback;
    if (!stkCallback) return reply.code(200).send(ack);

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;
    const payment = await Payment.findOne({ checkoutRequestId: CheckoutRequestID });
    if (!payment) {
      request.log.warn(`M-Pesa callback for unknown CheckoutRequestID: ${CheckoutRequestID}`);
      return reply.code(200).send(ack);
    }
    if (payment.status !== "pending") {
      // Already processed (Safaricom occasionally sends duplicate callbacks).
      return reply.code(200).send(ack);
    }

    payment.rawCallback = stkCallback;

    if (ResultCode === 0) {
      const items = CallbackMetadata?.Item || [];
      const get = (name) => items.find((i) => i.Name === name)?.Value;
      payment.status = "paid";
      payment.mpesaReceiptNumber = get("MpesaReceiptNumber");
      await payment.save();
      await applyPaymentSuccess(payment);
    } else {
      payment.status = "failed";
      payment.failureReason = ResultDesc;
      await payment.save();
    }

    return reply.code(200).send(ack);
  } catch (err) {
    request.log.error(err);
    return reply.code(200).send(ack);
  }
}

module.exports = mpesaCallback;
