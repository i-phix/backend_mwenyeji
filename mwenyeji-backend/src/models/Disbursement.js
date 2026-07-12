const mongoose = require("mongoose");

// Created automatically whenever a tenancy payment is confirmed — holds
// the landlord's net share until an admin manually pays it out (M-Pesa or
// bank transfer, done outside this system) and records the reference here.
const disbursementSchema = new mongoose.Schema(
  {
    tenancyId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenancy", required: true },
    landlordId: { type: mongoose.Schema.Types.ObjectId, ref: "Landlord", required: true },

    totalCollected: { type: Number, required: true },
    commissionAmount: { type: Number, required: true },
    netAmount: { type: Number, required: true },

    status: { type: String, enum: ["pending", "processing", "settled", "failed"], default: "pending" },

    method: { type: String, enum: ["mpesa", "bank"] },
    reference: { type: String }, // M-Pesa confirmation code or bank transaction ref
    note: { type: String },
    bankName: { type: String },
    bankAccount: { type: String },
    bankBranch: { type: String },

    disbursedAt: { type: Date },
    disbursedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

disbursementSchema.index({ landlordId: 1 });
disbursementSchema.index({ status: 1 });

module.exports = mongoose.model("Disbursement", disbursementSchema);
