const payservedb = require('payservedb');
const logger = require('../../../../config/winston');

async function get_ticket(request, reply) {
    try {
        const agent = request.user;
        const { ticket_id } = request.params;

        // Validate ticket_id
        if (!ticket_id) {
            return reply.code(400).send({
                success: false,
                error: 'Ticket ID is required'
            });
        }

        // First get raw ticket to see what fields exist
        const rawTicket = await payservedb.CustomerTicket.findById(ticket_id).lean();

        // Find ticket with all related data
        const ticket = await payservedb.CustomerTicket.findById(ticket_id)
            .populate('customer_id', 'fullName firstName lastName email phoneNumber phone unitId address')
            .populate('assigned_agent_id', 'fullName firstName lastName email phoneNumber')
            .populate('created_by_agent_id', 'fullName firstName lastName email phoneNumber')
            .populate('resolved_by', 'fullName firstName lastName email')
            .populate('facility_id', 'name company_id address')
            .populate('category_id', 'name priority color sla_minutes')
            .lean();

        if (!ticket) {
            return reply.code(404).send({
                success: false,
                error: 'Ticket not found'
            });
        }

        // Role-based access control
        const canAccess = checkTicketAccess(agent, ticket);
        if (!canAccess) {
            return reply.code(403).send({
                success: false,
                error: 'You do not have permission to view this ticket'
            });
        }

        // Get ticket communications (commented out for now - model may not exist)
        // const communications = await payservedb.TicketCommunication.find({
        //     ticket_id: ticket_id
        // })
        // .populate('agent_id', 'name email agent_id')
        // .sort({ created_at: 1 })
        // .lean();
        const communications = [];

        // Get ticket collaboration/notes (commented out for now - model may not exist)
        // const collaborations = await payservedb.TeamCollaboration.find({
        //     ticket_id: ticket_id
        // })
        // .populate('from_agent_id', 'name email agent_id')
        // .populate('to_agent_id', 'name email agent_id')
        // .sort({ created_at: 1 })
        // .lean();
        const collaborations = [];

        // Get customer's ticket history (last 10 tickets, only when a customer is linked)
        const customerId = ticket.customer_id?._id || ticket.customer_id;
        const customerHistory = customerId ? await payservedb.CustomerTicket.find({
            customer_id: customerId,
            _id: { $ne: ticket_id }
        })
        .populate('assigned_agent_id', 'fullName firstName lastName')
        .populate('category_id', 'name priority color')
        .sort({ created_at: -1 })
        .limit(10)
        .lean() : [];

        // Calculate SLA information
        const now = new Date();
        const sla_due = ticket.sla_due_date ? new Date(ticket.sla_due_date) : null;
        let sla_status = 'on_time';
        let time_remaining = null;

        if (sla_due) {
            time_remaining = sla_due.getTime() - now.getTime();
            if (time_remaining < 0) {
                sla_status = 'overdue';
            } else if (time_remaining < (2 * 60 * 60 * 1000)) { // Less than 2 hours
                sla_status = 'at_risk';
            }
        }

        // Get knowledge base suggestions based on ticket category (commented out for now - model may not exist)
        // const suggestions = await payservedb.KnowledgeBase.find({
        //     $or: [
        //         { category: ticket.category },
        //         { tags: { $in: [ticket.category, ticket.priority] } }
        //     ],
        //     status: 'published'
        // })
        // .select('title content_summary url helpful_count')
        // .sort({ helpful_count: -1 })
        // .limit(5)
        // .lean();
        const suggestions = [];

        const enrichedTicket = {
            ...ticket,
            sla_status,
            time_remaining: Math.max(0, time_remaining || 0),
            communications,
            collaborations,
            customer_history: customerHistory,
            knowledge_suggestions: suggestions
        };

        logger.info(`Agent ${agent.agent?.agent_id} viewed ticket ${ticket.ticket_number}`);

        return reply.code(200).send({
            success: true,
            data: enrichedTicket
        });

    } catch (error) {
        logger.error(`Error retrieving ticket: ${error.message}`, { stack: error.stack });
        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve ticket'
        });
    }
}

// Helper function to check ticket access permissions
function checkTicketAccess(agent, ticket) {
    const role = agent.agent?.role;
    const agentId = agent.userId || agent.agent?._id;

    // Managers can access all tickets
    if (role === 'manager') return true;

    // Team leaders/supervisors can access their team's tickets
    if (['team_leader', 'supervisor'].includes(role)) {
        if (agentId && agentId.toString() === ticket.created_by_agent_id?._id?.toString()) return true;
        if (agentId && agentId.toString() === ticket.assigned_agent_id?._id?.toString()) return true;
    }

    // Agents can access their own tickets or unassigned ones
    if (role === 'call_center_agent' || role === 'agent') {
        if (agentId && agentId.toString() === ticket.assigned_agent_id?._id?.toString()) return true;
        if (agentId && agentId.toString() === ticket.created_by_agent_id?._id?.toString()) return true;
        if (!ticket.assigned_agent_id) return true; // Unassigned tickets
    }

    // Default: allow access (can be made more restrictive later)
    return true;
}

module.exports = get_ticket;