const mongoose = require("mongoose");

// Singleton document (one row, _id: "default") for platform-wide settings
// that don't warrant their own dedicated model.
const feeBlockSchema = new mongoose.Schema(
  {
    rule: {
      type: String,
      enum: ["same_as_rent", "percentage_of_rent", "fixed_amount"],
      default: "fixed_amount",
    },
    value: { type: Number, default: 0 },
  },
  { _id: false },
);

const platformSettingSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "default" },
    defaultLeaseUrl: { type: String },

    // Phase 3 — payment settings. Reservation defaults to "full rent held
    // as first month", viewing defaults to free, commission defaults to 10%.
    reservation: { type: feeBlockSchema, default: () => ({ rule: "same_as_rent", value: 0 }) },
    viewing: { type: feeBlockSchema, default: () => ({ rule: "fixed_amount", value: 0 }) },
    commission: { type: feeBlockSchema, default: () => ({ rule: "percentage_of_rent", value: 10 }) },
  },
  { timestamps: true },
);

platformSettingSchema.statics.getSingleton = async function () {
  let doc = await this.findById("default");
  if (!doc) doc = await this.create({ _id: "default" });
  return doc;
};

module.exports = mongoose.model("PlatformSetting", platformSettingSchema);
