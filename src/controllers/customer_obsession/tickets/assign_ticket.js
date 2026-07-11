const payservedb = require('payservedb');
const logger = require('../../../../config/winston');

function getSupportLevel(role) {
    if (role === 'manager') return 3;
    if (['team_leader', 'supervisor', 'technician'].includes(role)) return 2;
    return 1;
}

async function resolveAssigningRole(agentUser) {
    const roleFromToken = agentUser?.agent?.role;
    if (roleFromToken) return roleFromToken;

    const agentDoc = await payservedb.Agent.findOne({ user_id: agentUser.userId }).select('role').lean();
    return agentDoc?.role || 'call_center_agent';
}

function validateAssignmentByLevel(assigningRole, targetRole) {
    const assigningLevel = getSupportLevel(assigningRole);
    const targetLevel = getSupportLevel(targetRole);

    if (targetLevel > assigningLevel) {
        return {
            valid: false,
            error: 'Use escalation to assign to higher level support'
        };
    }

    return { valid: true };
}

async function assign_ticket(request, reply) {
    try {
        const agent = request.user;
        const { ticket_id } = request.params;
        const { assigned_to, reassignment_reason } = request.body;

        if (!ticket_id) {
            return reply.code(400).send({
                success: false,
                error: 'Ticket ID is required'
            });
        }

        if (!assigned_to) {
            return reply.code(400).send({
                success: false,
                error: 'Agent ID to assign to is required'
            });
        }

        const existingTicket = await payservedb.CustomerTicket.findById(ticket_id)
            .populate('assigned_agent_id', 'fullName firstName lastName email')
            .populate('created_by_agent_id', 'fullName firstName lastName email')
            .populate('customer_id', 'fullName firstName lastName email phoneNumber phone unitId address preferences')
            .lean();

        if (!existingTicket) {
            return reply.code(404).send({
                success: false,
                error: 'Ticket not found'
            });
        }

        const targetAgent = await payservedb.Agent.findById(assigned_to).lean();
        if (!targetAgent) {
            return reply.code(404).send({
                success: false,
                error: 'Target agent not found'
            });
        }

        if (targetAgent.status !== 'active') {
            return reply.code(400).send({
                success: false,
                error: 'Target agent is not available for assignment'
            });
        }

        const assigningRole = await resolveAssigningRole(agent);
        const assignmentValidation = validateAssignmentByLevel(assigningRole, targetAgent.role);
        if (!assignmentValidation.valid) {
            return reply.code(400).send({
                success: false,
                error: assignmentValidation.error
            });
        }

        const targetUserId = targetAgent.user_id ? targetAgent.user_id.toString() : null;

        if (
            existingTicket.assigned_agent_id &&
            existingTicket.assigned_agent_id._id &&
            targetUserId &&
            existingTicket.assigned_agent_id._id.toString() === targetUserId
        ) {
            return reply.code(400).send({
                success: false,
                error: 'Ticket is already assigned to this agent'
            });
        }

        const previousAssignment = existingTicket.assigned_agent_id;

        const updateData = {
            assigned_agent_id: targetAgent.user_id,
            status: existingTicket.status === 'open' ? 'assigned' : existingTicket.status,
            updated_at: new Date()
        };

        if (!existingTicket.assigned_agent_id && targetAgent.user_id) {
            updateData.status = 'in_progress';
        }

        const updatedTicket = await payservedb.CustomerTicket.findByIdAndUpdate(
            ticket_id,
            updateData,
            { new: true, runValidators: true }
        )
            .populate('customer_id', 'fullName firstName lastName email phoneNumber phone unitId address preferences')
            .populate('assigned_agent_id', 'fullName firstName lastName email')
            .populate('created_by_agent_id', 'fullName firstName lastName email')
            .populate('facility_id', 'name company_id address')
            .lean();

        const activityLog = {
            agent_id: agent.userId,
            action: previousAssignment ? 'reassign' : 'assign',
            description: previousAssignment
                ? `Ticket reassigned from ${previousAssignment.fullName} to ${targetAgent.name}`
                : `Ticket assigned to ${targetAgent.name}`,
            metadata: {
                previous_agent: previousAssignment
                    ? {
                        id: previousAssignment._id,
                        name: previousAssignment.fullName
                    }
                    : null,
                new_agent: {
                    id: targetAgent._id,
                    name: targetAgent.name,
                    agent_id: targetAgent.agent_id,
                    role: targetAgent.role,
                    support_level: getSupportLevel(targetAgent.role)
                },
                assigned_by_role: assigningRole,
                assigned_by_support_level: getSupportLevel(assigningRole),
                reason: reassignment_reason
            },
            timestamp: new Date()
        };

        await payservedb.CustomerTicket.findByIdAndUpdate(ticket_id, {
            $push: {
                activity_log: activityLog,
                interactions: {
                    agent_id: agent.userId,
                    message: previousAssignment
                        ? `Ticket reassigned to ${targetAgent.name} (${targetAgent.agent_id})${reassignment_reason ? `. Reason: ${reassignment_reason}` : ''}`
                        : `Ticket assigned to ${targetAgent.name} (${targetAgent.agent_id})`,
                    is_internal_note: true,
                    created_at: new Date()
                }
            }
        });

        logger.info(`Agent ${agent.userId} assigned ticket ${existingTicket.ticket_number} to ${targetAgent.agent_id}`);

        const response = {
            ...updatedTicket,
            assignment_info: {
                assigned_by: {
                    id: agent.userId,
                    name: agent.fullName
                },
                assigned_at: new Date(),
                previous_assignment: previousAssignment,
                reason: reassignment_reason
            }
        };

        return reply.code(200).send({
            success: true,
            message: `Ticket ${previousAssignment ? 're' : ''}assigned successfully`,
            data: response
        });

    } catch (error) {
        logger.error(`Error assigning ticket: ${error.message}`);
        return reply.code(500).send({
            success: false,
            error: 'Failed to assign ticket'
        });
    }
}

module.exports = assign_ticket;
