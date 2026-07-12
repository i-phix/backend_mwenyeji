const mongoose = require("mongoose");

// A Mwenyeji tenant/renter account.
const tenantSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    phoneNumber: { type: String, trim: true },
    password: { type: String, required: true, minlength: 8 },
    isEmailVerified: { type: Boolean, default: false },
    verificationCode: { type: Number },
    verificationExpiration: { type: Date },

    status: { type: String, enum: ["active", "suspended", "inactive", "pending"], default: "active" },

    // Profile fields (Profile page) — nationalId/occupation/emergency
    // contact are optional, filled in by the tenant themselves.
    nationalId: { type: String },
    occupation: { type: String },
    emergencyContactName: { type: String },
    emergencyContactPhone: { type: String },

    preferences: {
      location: String,
      purpose: { type: String, enum: ["rent", "buy", "any"], default: "any" },
      budgetMin: Number,
      budgetMax: Number,
      roomTypes: [String],
      lifestyle: [String],
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Tenant", tenantSchema);
