const mongoose = require("mongoose");

// Captured from the public, unauthenticated preference wizard — keyed by a
// client-generated guestId rather than a Tenant, since the person hasn't
// registered yet. `syncPreferencesURL` (unused by the frontend today) would
// eventually reconcile these into Tenant.preferences post-registration.
const guestPreferenceSchema = new mongoose.Schema(
  {
    guestId: { type: String, required: true, index: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant" }, // set once synced to a real account

    purpose: { type: String, default: "any" },
    location: { type: String },
    roomTypes: [{ type: String }],
    lifestyle: [{ type: String }],
    budgetMin: { type: Number },
    budgetMax: { type: Number },
  },
  { timestamps: true },
);

module.exports = mongoose.model("GuestPreference", guestPreferenceSchema);
