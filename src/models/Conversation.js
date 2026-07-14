const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: "Unit" },
    landlordId: { type: mongoose.Schema.Types.ObjectId, ref: "Landlord", required: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true },

    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date },
    tenantUnread: { type: Number, default: 0 },
    landlordUnread: { type: Number, default: 0 },
  },
  { timestamps: true },
);

conversationSchema.index({ tenantId: 1, updatedAt: -1 });
conversationSchema.index({ landlordId: 1, updatedAt: -1 });
conversationSchema.index({ landlordId: 1, tenantId: 1, unitId: 1 });

module.exports = mongoose.model("Conversation", conversationSchema);
