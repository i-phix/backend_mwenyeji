const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: "Unit", required: true },
    landlordId: { type: mongoose.Schema.Types.ObjectId, ref: "Landlord", required: true },

    // Either a registered tenant, or guest contact details — never both empty.
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant" },
    guest: {
      fullName: String,
      email: String,
      phoneNumber: String,
    },

    message: { type: String, default: "" },
    desiredMoveInDate: { type: Date },
    occupation: { type: String },
    dob: { type: Date },
    gender: { type: String },
    termsAccepted: { type: Boolean, default: false },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" }, // set when applying from a viewing booking

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "rented"],
      default: "pending",
    },
    landlordNote: { type: String },
    respondedAt: { type: Date },

    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewNote: { type: String },
  },
  { timestamps: true },
);

applicationSchema.index({ unitId: 1 });
applicationSchema.index({ tenantId: 1 });
applicationSchema.index({ landlordId: 1, status: 1 });

module.exports = mongoose.model("Application", applicationSchema);
