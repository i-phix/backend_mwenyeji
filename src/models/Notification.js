const mongoose = require("mongoose");

// One collection for all three roles — recipientType + recipientId together
// identify who it belongs to, since Notification.recipientId can point at
// a Tenant, Landlord, or User (admin) document depending on recipientType.
const notificationSchema = new mongoose.Schema(
  {
    recipientType: { type: String, enum: ["tenant", "landlord", "admin"], required: true },
    recipientId: { type: mongoose.Schema.Types.ObjectId, required: true },

    type: { type: String, default: "info" }, // viewing|reservation|application|message|listing|unit_approval|commission|payment|info|success|warning
    title: { type: String, required: true },
    body: { type: String, default: "" },
    relatedId: { type: mongoose.Schema.Types.ObjectId },
    relatedType: { type: String },

    isRead: { type: Boolean, default: false },
  },
  { timestamps: true },
);

notificationSchema.index({ recipientType: 1, recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientType: 1, recipientId: 1, isRead: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
