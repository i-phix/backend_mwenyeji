const mongoose = require("mongoose");

// A tenant's (or guest's) claim on a viewing — either against a pre-defined
// ViewingSlot, or an ad-hoc requested date/time the landlord confirms later.
const bookingSchema = new mongoose.Schema(
  {
    slotId: { type: mongoose.Schema.Types.ObjectId, ref: "ViewingSlot" }, // absent for ad-hoc requests
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: "Unit", required: true },
    landlordId: { type: mongoose.Schema.Types.ObjectId, ref: "Landlord", required: true },
    unitName: { type: String }, // denormalized at creation time for fast list rendering

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant" },
    guest: {
      fullName: String,
      email: String,
      phoneNumber: String,
    },

    scheduledDate: { type: Date },
    scheduledTime: { type: String },
    tenantNote: { type: String },
    landlordMessage: { type: String },

    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed"],
      default: "pending",
    },
  },
  { timestamps: true },
);

bookingSchema.index({ unitId: 1 });
bookingSchema.index({ landlordId: 1, status: 1 });
bookingSchema.index({ tenantId: 1 });

module.exports = mongoose.model("Booking", bookingSchema);
