const mongoose = require("mongoose");

// A prospect's request to hold a unit ahead of a full application/tenancy.
const reservationSchema = new mongoose.Schema(
  {
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: "Unit", required: true },
    landlordId: { type: mongoose.Schema.Types.ObjectId, ref: "Landlord", required: true },
    unitName: { type: String },

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant" },
    guest: {
      fullName: String,
      email: String,
      phoneNumber: String,
    },
    isGuest: { type: Boolean, default: false },

    desiredMoveInDate: { type: Date },
    message: { type: String },
    landlordNote: { type: String },
    adminNote: { type: String },
    respondedAt: { type: Date },

    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "expired", "rented"],
      default: "pending",
    },
    expiresAt: { type: Date },

    // Fee support is wired up in Phase 3 (payments). Left in place now so
    // the frontend's existing fee-status UI has something to read.
    reservationFee: {
      amount: { type: Number, default: 0 },
      paidAt: { type: Date },
    },
  },
  { timestamps: true },
);

reservationSchema.index({ unitId: 1 });
reservationSchema.index({ landlordId: 1, status: 1 });
reservationSchema.index({ tenantId: 1 });

module.exports = mongoose.model("Reservation", reservationSchema);
