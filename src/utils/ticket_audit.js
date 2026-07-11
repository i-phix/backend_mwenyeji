const payservedb = require('payservedb');
const logger = require('../../config/winston');

/**
 * Log an audit action for a ticket
 * @param {String} ticket_id - The ticket ID
 * @param {Object} user - The user object from request.user
 * @param {String} action - The action being performed
 * @param {Object} details - Additional details about the action
 * @param {Object} request - The request object (optional, for IP and user agent)
 * @returns {Promise<Object>} The audit log entry
 */
async function logAuditAction(ticket_id, user, action, details = {}, request = null) {
    try {
        // Extract user information
        const user_id = user?.userId || user?._id;
        const user_name = user?.fullName || user?.email || 'System';
        const user_role = user?.agent?.role || user?.role || 'system';

        // Extract IP address and user agent from request
        let ip_address = null;
        let user_agent = null;

        if (request) {
            // Try multiple ways to get IP address
            ip_address = request.ip ||
                        request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                        request.headers['x-real-ip'] ||
                        request.connection?.remoteAddress ||
                        request.socket?.remoteAddress;

            user_agent = request.headers['user-agent'];
        }

        // Create audit entry
        const auditEntry = {
            user_id,
            user_name,
            user_role,
            action,
            field_changed: details.field_changed || null,
            old_value: details.old_value !== undefined ? details.old_value : null,
            new_value: details.new_value !== undefined ? details.new_value : null,
            description: details.description || generateDescription(action, details),
            ip_address,
            user_agent,
            metadata: details.metadata || {},
            timestamp: new Date()
        };

        // Add audit entry to ticket
        await payservedb.CustomerTicket.findByIdAndUpdate(
            ticket_id,
            {
                $push: { audit_log: auditEntry }
            }
        );

        logger.info(`Audit log created for ticket ${ticket_id}: ${action} by ${user_name}`);

        return auditEntry;

    } catch (error) {
        logger.error(`Error logging audit action for ticket ${ticket_id}: ${error.message}`);
        // Don't throw - audit logging should not break the main operation
        return null;
    }
}

/**
 * Log multiple audit actions at once (for bulk operations)
 * @param {String} ticket_id - The ticket ID
 * @param {Object} user - The user object
 * @param {Array} actions - Array of action objects
 * @param {Object} request - The request object
 * @returns {Promise<Array>} Array of audit log entries
 */
async function logMultipleAuditActions(ticket_id, user, actions, request = null) {
    try {
        const user_id = user?.userId || user?._id;
        const user_name = user?.fullName || user?.email || 'System';
        const user_role = user?.agent?.role || user?.role || 'system';

        let ip_address = null;
        let user_agent = null;

        if (request) {
            ip_address = request.ip ||
                        request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                        request.headers['x-real-ip'];
            user_agent = request.headers['user-agent'];
        }

        const auditEntries = actions.map(actionData => ({
            user_id,
            user_name,
            user_role,
            action: actionData.action,
            field_changed: actionData.field_changed || null,
            old_value: actionData.old_value !== undefined ? actionData.old_value : null,
            new_value: actionData.new_value !== undefined ? actionData.new_value : null,
            description: actionData.description || generateDescription(actionData.action, actionData),
            ip_address,
            user_agent,
            metadata: actionData.metadata || {},
            timestamp: new Date()
        }));

        // Add all audit entries at once
        await payservedb.CustomerTicket.findByIdAndUpdate(
            ticket_id,
            {
                $push: { audit_log: { $each: auditEntries } }
            }
        );

        logger.info(`${auditEntries.length} audit logs created for ticket ${ticket_id} by ${user_name}`);

        return auditEntries;

    } catch (error) {
        logger.error(`Error logging multiple audit actions for ticket ${ticket_id}: ${error.message}`);
        return [];
    }
}

/**
 * Generate a human-readable description for an action
 * @param {String} action - The action type
 * @param {Object} details - Action details
 * @returns {String} Description
 */
function generateDescription(action, details) {
    switch (action) {
        case 'created':
            return `Ticket created via ${details.source || 'portal'}`;

        case 'status_changed':
            return `Status changed from "${details.old_value}" to "${details.new_value}"`;

        case 'assigned':
            return `Ticket assigned to ${details.new_value}`;

        case 'reassigned':
            return `Ticket reassigned from ${details.old_value} to ${details.new_value}`;

        case 'escalated':
            return `Ticket escalated to ${details.new_value}${details.reason ? `: ${details.reason}` : ''}`;

        case 'auto_escalated':
            return `Ticket automatically escalated due to SLA breach`;

        case 'resolved':
            return `Ticket marked as resolved`;

        case 'closed':
            return `Ticket closed`;

        case 'reopened':
            return `Ticket reopened (reopened ${details.reopened_count || 1} time${details.reopened_count > 1 ? 's' : ''})`;

        case 'category_changed':
            return `Category changed from "${details.old_value}" to "${details.new_value}"`;

        case 'priority_changed':
            return `Priority changed from "${details.old_value}" to "${details.new_value}"`;

        case 'sla_updated':
            return `SLA due date updated`;

        case 'interaction_added':
            return details.is_internal ? 'Internal note added' : 'Response added';

        case 'attachment_added':
            return `Attachment added: ${details.filename || 'file'}`;

        case 'tag_added':
            return `Tag added: ${details.tag}`;

        case 'tag_removed':
            return `Tag removed: ${details.tag}`;

        case 'customer_response':
            return 'Customer responded to ticket';

        case 'agent_note':
            return 'Agent added internal note';

        case 'updated':
            if (details.field_changed) {
                return `Updated ${details.field_changed}`;
            }
            return 'Ticket updated';

        default:
            return `Action: ${action}`;
    }
}

/**
 * Get audit logs for a ticket
 * @param {String} ticket_id - The ticket ID
 * @param {Object} options - Query options (limit, skip, action filter)
 * @returns {Promise<Array>} Array of audit log entries
 */
async function getAuditLogs(ticket_id, options = {}) {
    try {
        const { limit = 100, skip = 0, action = null } = options;

        const ticket = await payservedb.CustomerTicket.findById(ticket_id)
            .select('audit_log')
            .lean();

        if (!ticket) {
            return [];
        }

        let logs = ticket.audit_log || [];

        // Filter by action if specified
        if (action) {
            logs = logs.filter(log => log.action === action);
        }

        // Sort by timestamp descending (newest first)
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Apply pagination
        return logs.slice(skip, skip + limit);

    } catch (error) {
        logger.error(`Error retrieving audit logs for ticket ${ticket_id}: ${error.message}`);
        return [];
    }
}

/**
 * Get audit log statistics for a ticket
 * @param {String} ticket_id - The ticket ID
 * @returns {Promise<Object>} Statistics object
 */
async function getAuditStats(ticket_id) {
    try {
        const ticket = await payservedb.CustomerTicket.findById(ticket_id)
            .select('audit_log')
            .lean();

        if (!ticket || !ticket.audit_log) {
            return {
                total_actions: 0,
                unique_users: 0,
                action_breakdown: {}
            };
        }

        const logs = ticket.audit_log;
        const uniqueUsers = new Set(logs.map(log => log.user_id?.toString()).filter(Boolean));

        const actionBreakdown = logs.reduce((acc, log) => {
            acc[log.action] = (acc[log.action] || 0) + 1;
            return acc;
        }, {});

        return {
            total_actions: logs.length,
            unique_users: uniqueUsers.size,
            action_breakdown: actionBreakdown,
            first_action: logs[logs.length - 1]?.timestamp,
            last_action: logs[0]?.timestamp
        };

    } catch (error) {
        logger.error(`Error retrieving audit stats for ticket ${ticket_id}: ${error.message}`);
        return null;
    }
}

module.exports = {
    logAuditAction,
    logMultipleAuditActions,
    generateDescription,
    getAuditLogs,
    getAuditStats
};
