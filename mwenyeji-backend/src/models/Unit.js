const mongoose = require("mongoose");

// A Mwenyeji listing. Clean field names — no "moveInX vs X" duplication.
// That duplication existed in the old schema only because listings could
// come from two different sources (native Move-In units vs. PayServe
// facility units bolted on with prefixed fields). There's only one source
// now, so there's only one set of field names.
const unitSchema = new mongoose.Schema(
  {
    landlordId: { type: mongoose.Schema.Types.ObjectId, ref: "Landlord", required: true },

    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    listingType: { type: String, enum: ["rent", "sale"], default: "rent" },
    unitType: { type: String, trim: true }, // e.g. bedsitter, studio, 1_bedroom, apartment, bungalow...

    price: { type: Number, required: true },
    bedrooms: { type: Number, default: 0 },
    bathrooms: { type: Number, default: 0 },
    grossArea: { type: Number }, // sq. metres

    images: [{ type: String }],
    amenities: [{ type: String }],
    nearbyServices: [{ type: String }],

    location: {
      city: { type: String, trim: true },
      county: { type: String, trim: true },
      area: { type: String, trim: true },
      address: { type: String, trim: true },
      landmarks: [{ type: String }],
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },

    isListed: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["available", "rented", "suspended"],
      default: "available",
    },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    rejectionReason: { type: String },

    featuredUntil: { type: Date },
    commissionRate: { type: Number }, // per-unit % override; falls back to platform default commission rule
    leaseDocumentUrl: { type: String }, // unit-specific lease template; falls back to platform default

    // Per-unit fee overrides (landlord-controlled). null/absent = "inherit
    // the platform default" — see FeesPanel in LandlordUnits.js.
    reservationFeeRule: { type: String, enum: ["same_as_rent", "percentage_of_rent", "fixed_amount"] },
    reservationFeeValue: { type: Number },
    viewingFeeRule: { type: String, enum: ["same_as_rent", "percentage_of_rent", "fixed_amount"] },
    viewingFeeValue: { type: Number },
  },
  { timestamps: true },
);

unitSchema.index({ "location.city": 1 });
unitSchema.index({ "location.area": 1 });
unitSchema.index({ landlordId: 1 });
unitSchema.index({ approvalStatus: 1, isListed: 1, status: 1 });

module.exports = mongoose.model("Unit", unitSchema);
