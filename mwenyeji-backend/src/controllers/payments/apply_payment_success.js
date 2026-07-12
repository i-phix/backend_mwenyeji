const Tenancy = require("../../models/Tenancy");
const Unit = require("../../models/Unit");
const Disbursement = require("../../models/Disbursement");
const { createBooking } = require("../viewings/book_slot");

// Dispatches the side effect that should happen once a Payment is confirmed
// paid, based on its `purpose`. Called from the M-Pesa callback handler —
// by the time this runs, the money has already landed, so failures here are
// logged rather than thrown (we never want to "undo" a successful payment).
async function applyPaymentSuccess(payment) {
  if (payment.purpose === "viewing") {
    const identity = payment.tenantId ? { tenantId: payment.tenantId } : { guest: payment.guest };
    try {
      await createBooking(
        {
          slotId: payment.meta?.slotId,
          unitId: payment.unitId,
          scheduledDate: payment.meta?.scheduledDate,
          scheduledTime: payment.meta?.scheduledTime,
          tenantNote: payment.meta?.tenantNote,
        },
        identity,
      );
    } catch (err) {
      // Payment succeeded but the slot/unit changed in the meantime — this
      // needs manual follow-up (refund or reschedule), not a silent retry.
      console.error(`[payments] Paid viewing ${payment.accountNumber} failed to create a booking:`, err.message);
    }
    return;
  }

  if (payment.purpose === "reservation") {
    const tenancy = await Tenancy.findById(payment.meta?.tenancyId);
    if (!tenancy) {
      console.error(`[payments] Paid reservation ${payment.accountNumber} has no matching tenancy`);
      return;
    }
    tenancy.paymentStatus = "paid";
    tenancy.amountPaid = payment.amount;
    tenancy.paidAt = new Date();
    tenancy.status = tenancy.leaseStatus === "approved" ? "active" : "awaiting_lease";
    if (tenancy.status === "active" && !tenancy.startDate) tenancy.startDate = new Date();
    await tenancy.save();

    await new Disbursement({
      tenancyId: tenancy._id,
      landlordId: tenancy.landlordId,
      totalCollected: tenancy.amount || payment.amount,
      commissionAmount: tenancy.commissionAmount,
      netAmount: tenancy.netToLandlord,
      status: "pending",
    }).save();
    return;
  }

  if (payment.purpose === "boost") {
    const unit = await Unit.findById(payment.unitId);
    if (!unit) return;
    const days = Number(payment.meta?.durationDays) || 0;
    const base = unit.featuredUntil && unit.featuredUntil > new Date() ? unit.featuredUntil : new Date();
    unit.featuredUntil = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    await unit.save();
    return;
  }
}

module.exports = applyPaymentSuccess;
