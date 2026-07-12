const mongoose = require("mongoose");

// Generic M-Pesa transaction ledger, shared by every revenue flow (viewing
// fee, reservation/first-month rent, featured-listing boost). `purpose` +
// `meta` carry enough context for the callback handler to apply the right
// side effect once Safaricom confirms payment.
const paymentSchema = new mongoose.Schema(
  {
    purpose: { type: String, enum: ["viewing", "reservation", "boost"], required: true },

    unitId: { type: mongoose.Schema.Types.ObjectId, ref: "Unit" },
    landlordId: { type: mongoose.Schema.Types.ObjectId, ref: "Landlord" },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant" },
    guest: {
      fullName: String,
      email: String,
      phoneNumber: String,
    },

    phone: { type: String, required: true }, // M-Pesa phone the STK push was sent to
    amount: { type: Number, required: true },
    currency: { type: String, default: "KES" },

    accountNumber: { type: String, required: true, unique: true }, // our reference, returned to frontend for polling
    checkoutRequestId: { type: String }, // Daraja CheckoutRequestID
    merchantRequestId: { type: String },
    mpesaReceiptNumber: { type: String },

    status: { type: String, enum: ["pending", "paid", "failed", "cancelled"], default: "pending" },
    failureReason: { type: String },
    rawCallback: { type: mongoose.Schema.Types.Mixed },

    // Purpose-specific context needed to apply the side effect on success —
    // e.g. { slotId, scheduledDate, scheduledTime, tenantNote } for viewing,
    // { tenancyId } for reservation, { packageId } for boost.
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

paymentSchema.index({ tenantId: 1 });
paymentSchema.index({ landlordId: 1 });
paymentSchema.index({ status: 1 });

module.exports = mongoose.model("Payment", paymentSchema);
