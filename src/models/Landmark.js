const mongoose = require("mongoose");

const landmarkSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["school", "hospital", "mall", "restaurant", "transport", "office", "market", "park", "road", "other"],
      default: "other",
    },
    area: { type: String, trim: true },
    city: { type: String, trim: true },
    county: { type: String, trim: true },
    address: { type: String, trim: true },
    details: { type: String },
    coordinates: {
      lat: Number,
      lng: Number,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

landmarkSchema.index({ isActive: 1 });
landmarkSchema.index({ category: 1 });

module.exports = mongoose.model("Landmark", landmarkSchema);
