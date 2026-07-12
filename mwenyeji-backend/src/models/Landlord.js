const mongoose = require("mongoose");

// A Mwenyeji landlord account — no linkage to any PayServe User. Signs up
// directly, gets verified by an admin, then can list units.
const landlordSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    phoneNumber: { type: String, required: true, trim: true, unique: true },
    companyName: { type: String, trim: true },
    password: { type: String, required: true, minlength: 8 },
    status: {
      type: String,
      enum: ["pending", "active", "suspended"],
      default: "pending",
    },
    verificationCode: { type: Number },
    verificationExpiration: { type: Date },
    isEmailVerified: { type: Boolean, default: false },

    // Standalone Mwenyeji has no separate "PayServe module" concept — every
    // landlord account already has full platform access. assignedAt just
    // marks when an admin activated them (kept for the admin UI's
    // "Assigned Date" column); isEnabled in API responses is derived from
    // status === 'active', not stored separately.
    assignedAt: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Landlord", landlordSchema);
