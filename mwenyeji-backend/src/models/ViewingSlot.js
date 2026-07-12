const mongoose = require("mongoose");

// A landlord-created time slot for a unit that tenants can book into.
const viewingSlotSchema = new mongoose.Schema(
  {
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: "Unit", required: true },
    landlordId: { type: mongoose.Schema.Types.ObjectId, ref: "Landlord", required: true },

    date: { type: Date, required: true },
    time: { type: String, required: true }, // "14:30" — display string, paired with `date`
    durationMins: { type: Number, default: 30 },
    capacity: { type: Number, default: 1 },
    bookedCount: { type: Number, default: 0 },

    status: { type: String, enum: ["active", "cancelled"], default: "active" },
  },
  { timestamps: true },
);

viewingSlotSchema.index({ unitId: 1, status: 1 });
viewingSlotSchema.index({ landlordId: 1 });

module.exports = mongoose.model("ViewingSlot", viewingSlotSchema);
