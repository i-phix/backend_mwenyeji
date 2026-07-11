const payservedb = require("payservedb");
const logger = require("./winston");

const ARCHIVED_API_METHODS = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

function serializeApiLog(log) {
  const row = typeof log.toObject === "function" ? log.toObject() : log;
  const method = String(row.method || "GET").toUpperCase();
  return {
    url: row.url,
    method: ARCHIVED_API_METHODS.has(method) ? method : "GET",
    duration: row.duration,
    time: row.time,
    date: row.date,
  };
}

function allowArchivedApiMethods() {
  const methodPath = payservedb.ArchivedApiLog?.schema?.path?.("method");
  if (methodPath?.enumValues) {
    for (const method of ARCHIVED_API_METHODS) {
      if (!methodPath.enumValues.includes(method)) methodPath.enumValues.push(method);
    }
  }
}

async function archiveOldLogs() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 1); // Logs older than 1 year

    // Archive API Logs
    if (payservedb.ApiLog && typeof payservedb.ApiLog.find === "function") {
      const oldAPILogs = await payservedb.ApiLog.find({
        time: { $lt: cutoffDate },
      });
      if (oldAPILogs.length > 0) {
        if (
          payservedb.ArchivedApiLog &&
          typeof payservedb.ArchivedApiLog.insertMany === "function"
        ) {
          allowArchivedApiMethods();
          await payservedb.ArchivedApiLog.insertMany(oldAPILogs.map(serializeApiLog));
          await payservedb.ApiLog.deleteMany({ time: { $lt: cutoffDate } });
          console.log(`Archived and removed ${oldAPILogs.length} api logs`);
          logger.info(`Archived and removed ${oldAPILogs.length} api logs`);
        } else {
          console.log("ArchivedApiLog model not available, skipping archive");
          logger.warn("ArchivedApiLog model not available, skipping archive");
        }
      } else {
        console.log("No logs to archive");
        logger.info("No api logs to archive");
      }
    } else {
      console.log("ApiLog model not available, skipping api log archive");
      logger.warn("ApiLog model not available, skipping api log archive");
    }

    // Archive Audit Logs (using AuditTrail if available)
    // Note: payservedb exports AuditTrail, not AuditLog
    const AuditLogModel = payservedb.AuditTrail || payservedb.AuditLog;
    const ArchivedAuditLogModel =
      payservedb.ArchivedAuditTrail || payservedb.ArchivedAuditLog;

    if (AuditLogModel && typeof AuditLogModel.find === "function") {
      const oldAuditLogs = await AuditLogModel.find({
        time: { $lt: cutoffDate },
      });
      if (oldAuditLogs.length > 0) {
        if (
          ArchivedAuditLogModel &&
          typeof ArchivedAuditLogModel.insertMany === "function"
        ) {
          await ArchivedAuditLogModel.insertMany(oldAuditLogs);
          await AuditLogModel.deleteMany({ time: { $lt: cutoffDate } });
          console.log(`Archived and removed ${oldAuditLogs.length} audit logs`);
          logger.info(`Archived and removed ${oldAuditLogs.length} audit logs`);
        } else {
          // No archived model available, just log the count
          console.log(
            `Found ${oldAuditLogs.length} old audit logs but no archive model available`,
          );
          logger.warn(
            `Found ${oldAuditLogs.length} old audit logs but ArchivedAuditLog model not available`,
          );
        }
      } else {
        console.log("No audit logs to archive");
        logger.info("No audit logs to archive");
      }
    } else {
      console.log(
        "AuditLog/AuditTrail model not available, skipping audit log archive",
      );
      logger.warn(
        "AuditLog/AuditTrail model not available, skipping audit log archive",
      );
    }
  } catch (err) {
    console.log("Error archiving logs:", err.message);
    logger.error(`Error archiving logs: ${err.message}`);
  }
}

module.exports = archiveOldLogs;
