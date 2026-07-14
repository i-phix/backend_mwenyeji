const mongoose = require("mongoose");

// Admin-configured tier a landlord can buy to boost a listing's visibility.
const featuredPackageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    durationDays: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    description: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

featuredPackageSchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model("FeaturedPackage", featuredPackageSchema);
