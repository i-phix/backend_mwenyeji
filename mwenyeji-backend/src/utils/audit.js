const AuditLog = require("../models/AuditLog");

// Call from admin-action controllers after the action succeeds. Never
// throws — a logging failure shouldn't fail the action it's describing.
async function logAdminAction(request, { action, resourceType, resourceId, details }) {
  try {
    await AuditLog.create({
      adminId: request.user?.userId,
      adminName: request.user?.email || request.user?.userId,
      action,
      resourceType,
      resourceId: resourceId ? String(resourceId) : undefined,
      details,
      ipAddress: request.ip,
    });
  } catch (err) {
    request.log?.warn?.(`Failed to write audit log: ${err.message}`);
  }
}

module.exports = { logAdminAction };
