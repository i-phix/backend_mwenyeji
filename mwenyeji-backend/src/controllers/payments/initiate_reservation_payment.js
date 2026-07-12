const Tenancy = require("../../models/Tenancy");
const Payment = require("../../models/Payment");
const { generateAccountNumber } = require("../../utils/accountNumber");
const { stkPush } = require("../../utils/mpesa");

// POST /api/move_in/reservations/initiate-payment — authenticated tenant
// Tenancy-first flow: an Application/Reservation must already have been
// marked "rented" (creating a Tenancy in awaiting_payment/awaiting_both).
// This just needs a phone number — everything else is on the Tenancy.
async function initiateReservationPayment(request, reply) {
  try {
    const { unitId, phone } = request.body || {};
    if (!unitId || !phone) return reply.code(400).send({ error: "unitId and phone are required" });

    const tenancy = await Tenancy.findOne({
      unitId,
      tenantId: request.user.userId,
      paymentStatus: { $ne: "paid" },
    }).sort({ createdAt: -1 });
    if (!tenancy) return reply.code(404).send({ error: "No pending tenancy found for this unit" });

    const amount = tenancy.amount || Number(tenancy.commissionAmount || 0) + Number(tenancy.netToLandlord || 0);
    if (amount <= 0) return reply.code(400).send({ error: "Tenancy has no amount due" });

    const payment = await new Payment({
      purpose: "reservation",
      unitId: tenancy.unitId,
      landlordId: tenancy.landlordId,
      tenantId: tenancy.tenantId,
      phone,
      amount,
      accountNumber: generateAccountNumber("RES"),
      meta: { tenancyId: tenancy._id },
    }).save();

    try {
      const stk = await stkPush({
        phone,
        amount,
        accountReference: payment.accountNumber,
        transactionDesc: "Rent payment",
      });
      payment.checkoutRequestId = stk.checkoutRequestId;
      payment.merchantRequestId = stk.merchantRequestId;
      await payment.save();
    } catch (err) {
      payment.status = "failed";
      payment.failureReason = err.message;
      await payment.save();
      return reply.code(502).send({ error: err.message });
    }

    return reply.code(201).send({
      success: true,
      data: { accountNumber: payment.accountNumber, amount: payment.amount, currency: payment.currency },
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = initiateReservationPayment;
