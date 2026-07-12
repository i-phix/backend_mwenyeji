const Unit = require("../../models/Unit");
const ViewingSlot = require("../../models/ViewingSlot");
const Payment = require("../../models/Payment");
const PlatformSetting = require("../../models/PlatformSetting");
const { computeAmountFromRule } = require("../../utils/feeRules");
const { generateAccountNumber } = require("../../utils/accountNumber");
const { stkPush } = require("../../utils/mpesa");

async function resolveUnitAndFee(body) {
  let unit;
  if (body.slotId) {
    const slot = await ViewingSlot.findById(body.slotId);
    if (!slot || slot.status !== "active") throw Object.assign(new Error("Slot not available"), { status: 404 });
    unit = await Unit.findById(slot.unitId);
  } else {
    if (!body.unitId) throw Object.assign(new Error("unitId is required"), { status: 400 });
    unit = await Unit.findById(body.unitId);
  }
  if (!unit) throw Object.assign(new Error("Listing not found"), { status: 404 });

  const settings = await PlatformSetting.getSingleton();
  const rule = unit.viewingFeeRule || settings.viewing?.rule || "fixed_amount";
  const value = unit.viewingFeeRule ? unit.viewingFeeValue : settings.viewing?.value;
  const amount = computeAmountFromRule(rule, value, unit.price);

  if (amount <= 0) {
    throw Object.assign(new Error("This viewing is free — no payment needed, book it directly"), { status: 400 });
  }

  return { unit, amount };
}

async function initiatePayment(body, identity) {
  const { unit, amount } = await resolveUnitAndFee(body);

  const payment = await new Payment({
    purpose: "viewing",
    unitId: unit._id,
    landlordId: unit.landlordId,
    phone: body.phone,
    amount,
    accountNumber: generateAccountNumber("VWG"),
    meta: {
      slotId: body.slotId || undefined,
      scheduledDate: body.scheduledDate || undefined,
      scheduledTime: body.scheduledTime || undefined,
      tenantNote: body.tenantNote || undefined,
    },
    ...identity,
  }).save();

  try {
    const stk = await stkPush({
      phone: body.phone,
      amount,
      accountReference: payment.accountNumber,
      transactionDesc: "Viewing fee",
    });
    payment.checkoutRequestId = stk.checkoutRequestId;
    payment.merchantRequestId = stk.merchantRequestId;
    await payment.save();
  } catch (err) {
    payment.status = "failed";
    payment.failureReason = err.message;
    await payment.save();
    throw Object.assign(new Error(err.message), { status: 502 });
  }

  return { accountNumber: payment.accountNumber, amount: payment.amount, currency: payment.currency };
}

// POST /api/move_in/viewings/initiate-payment — authenticated tenant
async function initiateViewingPayment(request, reply) {
  try {
    if (!request.body?.phone) return reply.code(400).send({ error: "phone is required" });
    const data = await initiatePayment(request.body, { tenantId: request.user.userId });
    return reply.code(201).send({ success: true, data });
  } catch (err) {
    if (err.status) return reply.code(err.status).send({ error: err.message });
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = initiateViewingPayment;
module.exports.initiatePayment = initiatePayment;
