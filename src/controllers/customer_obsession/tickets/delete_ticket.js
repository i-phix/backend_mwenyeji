const payservedb = require('payservedb');
const logger = require('../../../../config/winston');

async function delete_ticket(request, reply) {
    try {
        const agent = request.user;
        const { ticket_id } = request.params;
        const { archive_reason } = request.body;

        // Validate ticket_id
        if (!ticket_id) {
            return reply.code(400).send({
                success: false,
                error: 'Ticket ID is required'
            });
        }

        // Validate archive reason
        if (!archive_reason) {
            return reply.code(400).send({
                success: false,
                error: 'Archive reason is required'
            });
        }

        // Find existing ticket
        const existingTicket = await payservedb.CustomerTicket.findById(ticket_id)
            .populate('assigned_to', 'name agent_id role team_id')
            .populate('created_by', 'name agent_id')
            .populate('customer_id', 'name email phone')
            .lean();

        if (!existingTicket) {
            return reply.code(404).send({
                success: false,
                error: 'Ticket not found'
            });
        }

        // Check if ticket is already archived
        if (existingTicket.deleted_at) {
            return reply.code(400).send({
                success: false,
                error: 'Ticket is already archived'
            });
        }

        // Check archive permissions
        const canArchive = checkArchivePermissions(agent, existingTicket);
        if (!canArchive) {
            return reply.code(403).send({
                success: false,
                error: 'You do not have permission to archive this ticket'
            });
        }

        // Validate archiving based on ticket status
        const validationResult = validateTicketArchive(existingTicket);
        if (!validationResult.valid) {
            return reply.code(400).send({
                success: false,
                error: validationResult.error
            });
        }

        // ARCHIVE (Soft Delete) - Only option available
        const archiveData = {
            deleted_at: new Date(),
            deleted_by: agent.agent._id,
            deletion_reason: archive_reason,
            status: 'archived',
            updated_at: new Date()
        };

        const archivedTicket = await payservedb.CustomerTicket.findByIdAndUpdate(
            ticket_id,
            archiveData,
            { new: true, runValidators: true }
        )
        .populate('customer_id', 'firstName lastName email phoneNumber phone unitId')
        .populate('deleted_by', 'fullName email')
        .populate('assigned_agent_id', 'fullName email')
        .lean();

        const archiveResult = {
            type: 'archive',
            message: 'Ticket archived successfully',
            ticket: archivedTicket
        };

        logger.info(`Agent ${agent.agent.agent_id} archived ticket ${existingTicket.ticket_number}. Reason: ${archive_reason}`);

        // Add interaction for archive action
        await payservedb.CustomerTicket.findByIdAndUpdate(ticket_id, {
            $push: {
                interactions: {
                    agent_id: agent.userId,
                    message: `Ticket archived by ${agent.agent?.name || 'Agent'}. Reason: ${archive_reason}`,
                    is_internal_note: true,
                    created_at: new Date()
                }
            }
        });

        // Update agent workload
        if (existingTicket.assigned_agent_id) {
            await payservedb.Agent.findByIdAndUpdate(existingTicket.assigned_agent_id, {
                $inc: { current_ticket_count: -1 }
            });
        }

        return reply.code(200).send({
            success: true,
            message: archiveResult.message,
            data: {
                ticket_id,
                ticket_number: existingTicket.ticket_number,
                archive_type: archiveResult.type,
                archived_by: {
                    id: agent.userId,
                    name: agent.agent?.name,
                    agent_id: agent.agent?.agent_id
                },
                archived_at: new Date(),
                archive_reason,
                customer: existingTicket.customer_id ? {
                    name: `${existingTicket.customer_id.firstName || ''} ${existingTicket.customer_id.lastName || ''}`.trim(),
                    email: existingTicket.customer_id.email
                } : null
            }
        });

    } catch (error) {
        logger.error(`Error deleting ticket: ${error.message}`);
        return reply.code(500).send({
            success: false,
            error: 'Failed to delete ticket'
        });
    }
}

// Helper function to check archive permissions
function checkArchivePermissions(agent, ticket) {
    const role = agent.agent?.role;

    // Managers can delete any ticket
    if (role === 'manager') return true;

    // Supervisors can delete tickets in their domain
    if (role === 'supervisor') {
        // Can delete tickets they created or are assigned to them
        if (agent.agent._id.toString() === ticket.created_by?._id?.toString()) return true;
        if (agent.agent._id.toString() === ticket.assigned_to?._id?.toString()) return true;

        // Can delete team tickets if they're newly created (within 24 hours)
        if (ticket.assigned_to?.team_id === agent.agent.team_id) {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            if (new Date(ticket.created_at) > twentyFourHoursAgo) return true;
        }
    }

    // Team leaders can delete their own tickets or newly created team tickets
    if (role === 'team_leader') {
        if (agent.agent._id.toString() === ticket.created_by?._id?.toString()) return true;
        if (agent.agent._id.toString() === ticket.assigned_to?._id?.toString()) return true;

        // Can delete team tickets if newly created (within 2 hours)
        if (ticket.assigned_to?.team_id === agent.agent.team_id) {
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
            if (new Date(ticket.created_at) > twoHoursAgo) return true;
        }
    }

    // Call center agents can only delete their own tickets within 1 hour of creation
    if (role === 'call_center_agent') {
        if (agent.agent._id.toString() === ticket.created_by?._id?.toString()) {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            if (new Date(ticket.created_at) > oneHourAgo) return true;
        }
    }

    return false;
}

// Helper function to validate ticket archive
function validateTicketArchive(ticket) {
    // Cannot archive escalated tickets unless resolved first
    if (ticket.status === 'escalated') {
        return {
            valid: false,
            error: 'Cannot archive escalated tickets. Please resolve or de-escalate first'
        };
    }

    // Recommend resolving open tickets before archiving
    if (ticket.status === 'open' || ticket.status === 'in_progress') {
        return {
            valid: false,
            error: 'Please close or resolve open tickets before archiving'
        };
    }

    return { valid: true };
}

module.exports = delete_ticket;