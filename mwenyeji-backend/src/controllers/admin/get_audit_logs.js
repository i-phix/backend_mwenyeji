const AuditLog = require("../../models/AuditLog");

// GET /api/core/move_in/audit_logs — authenticated admin
// Frontend does all filtering/pagination client-side over the full list —
// capped at 500 most-recent entries so this stays bounded as the log grows.
async function getAuditLogs(request, reply) {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(500).lean();
    return reply.code(200).send({ success: true, data: logs });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getAuditLogs;
