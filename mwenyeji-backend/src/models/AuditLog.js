const mongoose = require("mongoose");

// Written at key admin actions (listing approve/reject, disbursement,
// customer/landlord account changes, password resets). adminName/adminEmail
// are snapshotted at write time so the log stays readable even if the
// admin account is later renamed or removed.
const auditLogSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    adminName: { type: String },

    action: { type: String, required: true },
    resourceType: { type: String },
    resourceId: { type: String },
    details: { type: String },
    ipAddress: { type: String },
  },
  { timestamps: true },
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
