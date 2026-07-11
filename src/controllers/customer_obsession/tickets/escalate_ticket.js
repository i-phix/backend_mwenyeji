const payservedb = require('payservedb');
const logger = require('../../../../config/winston');
const { sendSms } = require('../../../utils/send_new_sms');
const { sendEmail } = require('../../../utils/send_new_email');

function getSupportLevel(role) {
    if (['manager', 'admin', 'supervisor'].includes(role)) return 3;
    if (['field_operator', 'developer', 'technician', 'team_leader'].includes(role)) return 2;
    return 1; // call_center_agent, agent, and anything else
}

function toEscalationLevelString(level) {
    return level === 3 ? 'level_3' : 'level_2';
}

function getRolesForLevel(level) {
    if (level === 3) return ['manager', 'admin', 'supervisor'];
    return ['field_operator', 'developer', 'technician', 'team_leader'];
}

async function resolveUserRole(user) {
    const roleFromToken = user?.agent?.role;
    if (roleFromToken) return roleFromToken;

    const agentDoc = await payservedb.Agent.findOne({ user_id: user.userId }).select('role').lean();
    return agentDoc?.role || 'call_center_agent';
}

async function findEscalationTargetByLevel(level) {
    const roles = getRolesForLevel(level);

    return payservedb.Agent.findOne({
        role: { $in: roles },
        status: 'active'
    })
        .sort({ is_available: -1, updated_at: -1 })
        .lean();
}

async function escalate_ticket(request, reply) {
    try {
        const user = request.user;
        const { ticket_id } = request.params;
        const {
            escalation_reason,
            escalation_notes,
            escalate_to_agent,
            escalate_to_level,
            urgency_level = 'high'
        } = request.body;

        if (!ticket_id) {
            return reply.code(400).send({
                success: false,
                error: 'Ticket ID is required'
            });
        }

        if (!escalation_reason) {
            return reply.code(400).send({
                success: false,
                error: 'Escalation reason is required'
            });
        }

        const existingTicket = await payservedb.CustomerTicket.findById(ticket_id)
            .populate('assigned_agent_id', 'fullName firstName lastName email')
            .populate('created_by_agent_id', 'fullName firstName lastName email')
            .populate('customer_id', 'fullName firstName lastName email phoneNumber phone unitId')
            .lean();

        if (!existingTicket) {
            return reply.code(404).send({
                success: false,
                error: 'Ticket not found'
            });
        }

        if (['resolved', 'closed'].includes(existingTicket.status)) {
            return reply.code(400).send({
                success: false,
                error: 'Cannot escalate a resolved or closed ticket'
            });
        }

        if (existingTicket.status === 'escalated') {
            return reply.code(400).send({
                success: false,
                error: 'Ticket is already escalated'
            });
        }

        const userRole = await resolveUserRole(user);
        const callerLevel = getSupportLevel(userRole);

        if (callerLevel === 3) {
            return reply.code(400).send({
                success: false,
                error: 'L3 agents cannot escalate tickets further'
            });
        }

        const requestedLevel = escalate_to_level ? parseInt(escalate_to_level, 10) : (callerLevel === 1 ? 2 : 3);

        if (![2, 3].includes(requestedLevel)) {
            return reply.code(400).send({
                success: false,
                error: 'escalate_to_level must be 2 or 3'
            });
        }

        if (requestedLevel <= callerLevel) {
            return reply.code(400).send({
                success: false,
                error: 'Escalation must be to a higher support level'
            });
        }

        let escalationTarget = null;

        if (escalate_to_agent) {
            escalationTarget = await payservedb.Agent.findById(escalate_to_agent).lean();
            if (!escalationTarget) {
                return reply.code(404).send({
                    success: false,
                    error: 'Target escalation agent not found'
                });
            }

            if (escalationTarget.status !== 'active') {
                return reply.code(400).send({
                    success: false,
                    error: 'Target escalation agent is not active'
                });
            }

            const targetLevel = getSupportLevel(escalationTarget.role);

            if (targetLevel <= callerLevel) {
                return reply.code(400).send({
                    success: false,
                    error: 'Cannot escalate to an agent of equal or lower support level'
                });
            }

            if (requestedLevel && targetLevel !== requestedLevel) {
                return reply.code(400).send({
                    success: false,
                    error: `Selected agent is not in level ${requestedLevel} support`
                });
            }
        } else {
            escalationTarget = await findEscalationTargetByLevel(requestedLevel);
            if (!escalationTarget) {
                return reply.code(404).send({
                    success: false,
                    error: `No active support agent available in level ${requestedLevel}`
                });
            }
        }

        const targetLevel = getSupportLevel(escalationTarget.role);
        const finalEscalationLevel = toEscalationLevelString(targetLevel);
        const assignedUserId = escalationTarget.user_id || escalationTarget._id;

        const previousAssignment = existingTicket.assigned_agent_id;

        const updateData = {
            status: 'escalated',
            assigned_agent_id: assignedUserId,
            escalated_to: assignedUserId,
            priority: urgency_level === 'critical' ? 'urgent' : existingTicket.priority,
            escalation_level: finalEscalationLevel,
            escalated_at: new Date(),
            escalated_by: user.userId,
            escalation_reason,
            escalation_notes,
            updated_at: new Date()
        };

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

        await payservedb.AgentNotification.create({
            user_id: assignedUserId,
            type: 'ticket_escalated',
            title: 'Ticket Escalated to You',
            message: `Ticket #${existingTicket.ticket_number} has been escalated to you.`,
            ticket_id: ticket_id,
            ticket_number: existingTicket.ticket_number,
            link: `/agent/tickets/${ticket_id}`,
            metadata: {
                escalated_by: user.userId,
                escalation_reason,
                urgency_level,
                escalation_level: finalEscalationLevel,
                escalate_to_level: targetLevel
            }
        });

        const facilityId = existingTicket.facility_id;
        const escalatedByName = user.fullName || user.name || 'An agent';

        if (escalationTarget.phone) {
            const smsMessage = `Ticket #${existingTicket.ticket_number} escalated to you. Urgency: ${urgency_level}. Reason: ${escalation_reason}. Login to action.`;
            sendSms(facilityId, escalationTarget.phone, smsMessage).catch(err =>
                logger.error(`Failed to send escalation SMS to agent ${escalationTarget.agent_id}: ${err.message}`)
            );
        }

        if (escalationTarget.email) {
            const emailSubject = `Ticket #${existingTicket.ticket_number} Escalated to You`;
            const emailText = `Hi ${escalationTarget.name},\n\nTicket #${existingTicket.ticket_number} has been escalated to you by ${escalatedByName}.\n\nUrgency: ${urgency_level}\nEscalation Level: ${finalEscalationLevel}\nReason: ${escalation_reason}${escalation_notes ? `\nNotes: ${escalation_notes}` : ''}\n\nPlease log in to review and action this ticket promptly.\n\nPayServe Customer Obsession`;
            sendEmail(facilityId, escalationTarget.email, emailSubject, emailText).catch(err =>
                logger.error(`Failed to send escalation email to agent ${escalationTarget.agent_id}: ${err.message}`)
            );
        }

        await payservedb.CustomerTicket.findByIdAndUpdate(ticket_id, {
            $push: {
                activity_log: {
                    agent_id: user.userId,
                    action: 'escalate',
                    description: `Ticket escalated to ${escalationTarget.name} (${escalationTarget.agent_id})`,
                    metadata: {
                        escalated_to: {
                            id: escalationTarget._id,
                            name: escalationTarget.name,
                            agent_id: escalationTarget.agent_id,
                            role: escalationTarget.role
                        },
                        escalation_level: finalEscalationLevel,
                        escalation_reason,
                        escalation_notes,
                        urgency_level,
                        previous_agent: previousAssignment
                            ? {
                                id: previousAssignment._id,
                                name: previousAssignment.fullName
                            }
                            : null
                    },
                    timestamp: new Date()
                },
                interactions: {
                    agent_id: user.userId,
                    message: `TICKET ESCALATED to ${escalationTarget.name} (${escalationTarget.agent_id})\n\nEscalation Level: ${finalEscalationLevel}\nReason: ${escalation_reason}\nUrgency: ${urgency_level}\n\nNotes: ${escalation_notes || 'None provided'}`,
                    is_internal_note: true,
                    created_at: new Date()
                }
            }
        });

        logger.info(`Agent ${user.userId} escalated ticket ${existingTicket.ticket_number} to ${escalationTarget.agent_id} (${finalEscalationLevel})`);

        return reply.code(200).send({
            success: true,
            message: 'Ticket escalated successfully',
            data: {
                ...updatedTicket,
                escalation_info: {
                    escalated_by: {
                        id: user.userId,
                        name: user.fullName
                    },
                    escalated_to: {
                        id: escalationTarget._id,
                        name: escalationTarget.name,
                        agent_id: escalationTarget.agent_id,
                        role: escalationTarget.role
                    },
                    escalated_at: updateData.escalated_at,
                    escalation_level: finalEscalationLevel,
                    escalation_reason,
                    urgency_level,
                    escalate_to_level: targetLevel
                }
            }
        });

    } catch (error) {
        logger.error(`Error escalating ticket: ${error.message}`, { stack: error.stack });
        return reply.code(500).send({
            success: false,
            error: 'Failed to escalate ticket',
            details: error.message
        });
    }
}

module.exports = escalate_ticket;
