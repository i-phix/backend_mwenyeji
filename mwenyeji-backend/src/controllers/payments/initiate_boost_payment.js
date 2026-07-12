const Unit = require("../../models/Unit");
const FeaturedPackage = require("../../models/FeaturedPackage");
const Payment = require("../../models/Payment");
const { generateAccountNumber } = require("../../utils/accountNumber");
const { stkPush } = require("../../utils/mpesa");

// POST /api/move_in/landlord/units/:unitId/boost — authenticated landlord
async function initiateBoostPayment(request, reply) {
  try {
    const { unitId } = request.params;
    const { phone, packageId } = request.body || {};
    if (!phone || !packageId) return reply.code(400).send({ error: "phone and packageId are required" });

    const unit = await Unit.findOne({ _id: unitId, landlordId: request.user.userId });
    if (!unit) return reply.code(404).send({ error: "Unit not found" });

    const pkg = await FeaturedPackage.findOne({ _id: packageId, isActive: true });
    if (!pkg) return reply.code(404).send({ error: "Package not found" });

    const payment = await new Payment({
      purpose: "boost",
      unitId: unit._id,
      landlordId: request.user.userId,
      phone,
      amount: pkg.price,
      accountNumber: generateAccountNumber("BST"),
      meta: { packageId: pkg._id, durationDays: pkg.durationDays },
    }).save();

    try {
      const stk = await stkPush({
        phone,
        amount: pkg.price,
        accountReference: payment.accountNumber,
        transactionDesc: "Listing boost",
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

module.exports = initiateBoostPayment;
