const payservedb = require('payservedb');
const logger = require('../../../../config/winston');
const { getAuditLogs, getAuditStats } = require('../../../utils/ticket_audit');

async function get_audit_logs(request, reply) {
    try {
        const agent = request.user;
        const { ticket_id } = request.params;
        const { limit, skip, action } = request.query;

        // Validate ticket_id
        if (!ticket_id) {
            return reply.code(400).send({
                success: false,
                error: 'Ticket ID is required'
            });
        }

        // Find ticket to verify it exists and check access
        const ticket = await payservedb.CustomerTicket.findById(ticket_id)
            .select('ticket_number customer_id assigned_agent_id created_by_agent_id')
            .lean();

        if (!ticket) {
            return reply.code(404).send({
                success: false,
                error: 'Ticket not found'
            });
        }

        // Get audit logs with filters
        const options = {
            limit: limit ? parseInt(limit) : 100,
            skip: skip ? parseInt(skip) : 0,
            action: action || null
        };

        const auditLogs = await getAuditLogs(ticket_id, options);

        // Get audit statistics
        const stats = await getAuditStats(ticket_id);

        logger.info(`Agent ${agent.agent?.agent_id} retrieved ${auditLogs.length} audit logs for ticket ${ticket.ticket_number}`);

        return reply.code(200).send({
            success: true,
            data: {
                ticket_number: ticket.ticket_number,
                audit_logs: auditLogs,
                stats: stats,
                pagination: {
                    limit: options.limit,
                    skip: options.skip,
                    returned: auditLogs.length
                }
            }
        });

    } catch (error) {
        logger.error(`Error retrieving audit logs: ${error.message}`, { stack: error.stack });
        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve audit logs'
        });
    }
}

module.exports = get_audit_logs;
