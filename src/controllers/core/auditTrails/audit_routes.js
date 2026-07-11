const { getAuditLogs, getAuditStats } = require('../../../utils/audit_trails');

// Controller to get audit logs with filtering and pagination
const getAuditLogsController = async (request, reply) => {
  try {
    const filters = {
      page: request.query.page || 1,
      limit: request.query.limit || 50,
      activity: request.query.activity,
      userId: request.query.userId,
      facilityId: request.query.facilityId,
      method: request.query.method,
      platform: request.query.platform,
      startDate: request.query.startDate,
      endDate: request.query.endDate,
      isAuthorized: request.query.isAuthorized,
      browser: request.query.browser,
      operatingSystem: request.query.operatingSystem,
      deviceType: request.query.deviceType,
      ipAddress: request.query.ipAddress,
      sortBy: request.query.sortBy || 'timestamp',
      sortOrder: request.query.sortOrder || 'DESC'
    };

    // Validate date formats if provided
    if (filters.startDate && !isValidDate(filters.startDate)) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid startDate format. Use YYYY-MM-DD or ISO format.'
      });
    }

    if (filters.endDate && !isValidDate(filters.endDate)) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid endDate format. Use YYYY-MM-DD or ISO format.'
      });
    }

    // Validate pagination parameters
    const page = parseInt(filters.page);
    const limit = parseInt(filters.limit);

    if (page < 1) {
      return reply.code(400).send({
        success: false,
        error: 'Page must be greater than 0'
      });
    }

    if (limit < 1 || limit > 1000) {
      return reply.code(400).send({
        success: false,
        error: 'Limit must be between 1 and 1000'
      });
    }

    const result = await getAuditLogs(filters);

    if (!result.success) {
      return reply.code(500).send(result);
    }

    return reply.code(200).send(result);

  } catch (error) {
    console.error('Error in getAuditLogsController:', error);
    return reply.code(500).send({
      success: false,
      error: 'Internal server error while fetching audit logs'
    });
  }
};

// Controller to get audit statistics
const getAuditStatsController = async (request, reply) => {
  try {
    const filters = {
      facilityId: request.query.facilityId,
      userId: request.query.userId,
      startDate: request.query.startDate,
      endDate: request.query.endDate
    };

    // Validate date formats if provided
    if (filters.startDate && !isValidDate(filters.startDate)) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid startDate format. Use YYYY-MM-DD or ISO format.'
      });
    }

    if (filters.endDate && !isValidDate(filters.endDate)) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid endDate format. Use YYYY-MM-DD or ISO format.'
      });
    }

    const result = await getAuditStats(filters);

    if (!result.success) {
      return reply.code(500).send(result);
    }

    return reply.code(200).send(result);

  } catch (error) {
    console.error('Error in getAuditStatsController:', error);
    return reply.code(500).send({
      success: false,
      error: 'Internal server error while fetching audit statistics'
    });
  }
};

// Controller to get audit log by ID
const getAuditLogByIdController = async (request, reply) => {
  try {
    const { logId } = request.params;

    if (!logId) {
      return reply.code(400).send({
        success: false,
        error: 'Log ID is required'
      });
    }

    const { getAuditLogById } = require('../../../utils/audit_trails');
    const result = await getAuditLogById(logId);

    if (!result.success) {
      if (result.notFound) {
        return reply.code(404).send({
          success: false,
          error: 'Audit log not found'
        });
      }
      return reply.code(500).send(result);
    }

    return reply.code(200).send(result);

  } catch (error) {
    console.error('Error in getAuditLogByIdController:', error);
    return reply.code(500).send({
      success: false,
      error: 'Internal server error while fetching audit log'
    });
  }
};

// Helper function to validate date format
const isValidDate = (dateString) => {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

// Register routes function
const registerAuditRoutes = async (fastify) => {
  const auditBaseRoute = '/api/core/audit';

  // Get audit logs with filtering and pagination
  fastify.get(`${auditBaseRoute}/logs`, getAuditLogsController);

  // Get audit statistics
  fastify.get(`${auditBaseRoute}/stats`, getAuditStatsController);

  // Get specific audit log by ID
  fastify.get(`${auditBaseRoute}/logs/:logId`, getAuditLogByIdController);

  console.log('✅ Audit routes registered successfully');
};

module.exports = {
  registerAuditRoutes,
  getAuditLogsController,
  getAuditStatsController,
  getAuditLogByIdController
};