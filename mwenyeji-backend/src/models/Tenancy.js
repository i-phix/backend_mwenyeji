const mongoose = require("mongoose");

// Created the moment a landlord marks an Application or Reservation as
// "rented". Tracks the payment + lease-signing lifecycle that follows.
// Actual M-Pesa payment initiation/polling is wired up in Phase 3 — this
// model already carries the fields the frontend (MyTenancy.js) reads so
// that phase can plug straight in without another schema change.
const tenancySchema = new mongoose.Schema(
  {
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Application" },
    reservationId: { type: mongoose.Schema.Types.ObjectId, ref: "Reservation" },
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: "Unit", required: true },
    landlordId: { type: mongoose.Schema.Types.ObjectId, ref: "Landlord", required: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant" },

    unitName: { type: String },
    accountNumber: { type: String, required: true, unique: true }, // M-Pesa payment reference

    status: {
      type: String,
      enum: ["awaiting_both", "awaiting_payment", "awaiting_lease", "active", "cancelled", "ended"],
      default: "awaiting_both",
    },

    // Payment
    amount: { type: Number, default: 0 }, // total due (== netToLandlord + commissionAmount), snapshotted at creation
    paymentStatus: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
    amountPaid: { type: Number, default: 0 },
    paidAt: { type: Date },
    commissionType: { type: String, enum: ["percentage", "flat"], default: "percentage" },
    commissionValue: { type: Number, default: 10 }, // % or flat KES, per commissionType
    commissionAmount: { type: Number, default: 0 },
    netToLandlord: { type: Number, default: 0 },

    // Lease
    leaseStatus: {
      type: String,
      enum: ["pending", "downloaded", "uploaded", "approved", "rejected"],
      default: "pending",
    },
    leaseDocumentUrl: { type: String },  // blank template tenant downloads
    signedLeaseUrl: { type: String },    // tenant's signed upload
    leaseRejectionReason: { type: String },

    startDate: { type: Date },
    endDate: { type: Date },
  },
  { timestamps: true },
);

tenancySchema.index({ tenantId: 1 });
tenancySchema.index({ landlordId: 1 });
tenancySchema.index({ unitId: 1 });

module.exports = mongoose.model("Tenancy", tenancySchema);
