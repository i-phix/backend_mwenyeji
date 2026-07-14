const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
    senderType: { type: String, enum: ["tenant", "landlord"], required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
    body: { type: String, required: true },
    type: { type: String, default: "text" },
  },
  { timestamps: true },
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model("Message", messageSchema);
