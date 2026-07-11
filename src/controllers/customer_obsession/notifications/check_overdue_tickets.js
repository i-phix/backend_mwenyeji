const payservedb = require('payservedb');
const logger = require('../../../../config/winston');
const { sendSms } = require('../../../utils/send_new_sms');
const { sendEmail } = require('../../../utils/send_new_email');
const { logAuditAction } = require('../../../utils/ticket_audit');

// Configuration for escalation rules
const ESCALATION_CONFIG = {
    // Escalate after SLA breach + grace period (in minutes)
    GRACE_PERIOD_MINUTES: 120, // 2 hours
    // Notification reminder interval (in minutes)
    REMINDER_INTERVAL_MINUTES: 720 // 12 hours
};

async function getEscalationSettings() {
    try {
        const settings = await payservedb.Settings.findOne({
            name: 'customer_obsession_global',
            size: 'global'
        }).select('escalation_timer_minutes escalation_target_level').lean();
        const val = settings?.escalation_timer_minutes;
        return {
            timerMinutes: val && Number(val) > 0 ? Number(val) : null,
            targetLevel: settings?.escalation_target_level ?? 3
        };
    } catch (err) {
        logger.error(`Failed to read escalation settings from DB: ${err.message}`);
        return { timerMinutes: null, targetLevel: 3 };
    }
}

async function getRoleCodesForLevel(targetLevel) {
    try {
        const roles = await payservedb.AgentRole.find({
            level: targetLevel,
            active: true
        }).select('code').lean();
        const codes = roles.map(r => r.code);
        if (codes.length > 0) return codes;
        // Fallback to higher levels if none found at exact level
        const higherRoles = await payservedb.AgentRole.find({
            level: { $gte: targetLevel },
            active: true
        }).select('code').lean();
        return higherRoles.map(r => r.code);
    } catch (err) {
        logger.error(`Failed to fetch roles for level ${targetLevel}: ${err.message}`);
        return [];
    }
}

async function check_overdue_tickets() {
    try {
        const now = new Date();
        const { timerMinutes: escalationTimerMinutes, targetLevel: escalationTargetLevel } = await getEscalationSettings();

        // Find tickets that are not resolved/closed/archived
        const activeTickets = await payservedb.CustomerTicket.find({
            status: { $nin: ['resolved', 'closed', 'archived'] }
        })
        .populate('assigned_agent_id', 'fullName email phoneNumber')
        .populate('created_by_agent_id', 'fullName email phoneNumber')
        .populate('category_id', 'name priority sla_minutes')
        .lean();

        logger.info(`Checking ${activeTickets.length} active tickets for SLA breaches and escalation`);

        let notified = 0;
        let escalated = 0;
        let updated = 0;

        for (const ticket of activeTickets) {
            const sla_due = ticket.sla_due_date ? new Date(ticket.sla_due_date) : null;
            const minutesOverdue = sla_due ? (now - sla_due) / (1000 * 60) : 0;
            const minutesSinceCreation = (now - new Date(ticket.created_at)) / (1000 * 60);

            // Determine if ticket should be escalated
            const timerExceeded = escalationTimerMinutes !== null && minutesSinceCreation > escalationTimerMinutes;
            const shouldEscalate = (
                ticket.status !== 'escalated' && (
                    // SLA breached + grace period exceeded
                    (sla_due && minutesOverdue > ESCALATION_CONFIG.GRACE_PERIOD_MINUTES) ||
                    // Or configured timer exceeded (from DB settings)
                    timerExceeded
                )
            );

            // Update SLA status if needed
            if (sla_due) {
                let newSlaStatus = ticket.sla_status;

                if (minutesOverdue > 0) {
                    newSlaStatus = 'breached';
                } else if (minutesOverdue > -120) { // Within 2 hours of SLA
                    newSlaStatus = 'at_risk';
                } else {
                    newSlaStatus = 'on_time';
                }

                // Update SLA status if changed
                if (newSlaStatus !== ticket.sla_status) {
                    await payservedb.CustomerTicket.findByIdAndUpdate(ticket._id, {
                        sla_status: newSlaStatus
                    });
                    updated++;
                    logger.info(`Updated SLA status for ticket ${ticket.ticket_number} to ${newSlaStatus}`);
                }
            }

            // Auto-escalate if criteria met
            if (shouldEscalate) {
                await autoEscalateTicket(ticket, minutesOverdue, minutesSinceCreation, escalationTargetLevel);
                escalated++;
            }
            // Send reminders for overdue but not yet escalated tickets
            else if (sla_due && minutesOverdue > 0) {
                await sendOverdueReminder(ticket, minutesOverdue);
                notified++;
            }
        }

        logger.info(`Overdue check completed: ${updated} SLA updates, ${escalated} escalations, ${notified} notifications`);

        return {
            success: true,
            checked: activeTickets.length,
            sla_updates: updated,
            escalated: escalated,
            notified: notified
        };

    } catch (error) {
        logger.error(`Error checking overdue tickets: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}

async function autoEscalateTicket(ticket, minutesOverdue, minutesSinceCreation, targetLevel = 3) {
    try {
        const hoursOverdue = (minutesOverdue / 60).toFixed(1);
        const hoursSinceCreation = (minutesSinceCreation / 60).toFixed(1);

        logger.info(`Auto-escalating ticket ${ticket.ticket_number} - ${hoursOverdue}h overdue, ${hoursSinceCreation}h since creation`);

        // Find a suitable escalation target based on configured level
        const escalationTarget = await findEscalationTarget(ticket, targetLevel);

        if (!escalationTarget) {
            logger.warn(`No escalation target found for ticket ${ticket.ticket_number}`);
            return;
        }

        const escalationReason = minutesOverdue > 0
            ? `SLA breached by ${hoursOverdue} hours`
            : `Ticket open for ${hoursSinceCreation} hours without resolution`;

        // Update ticket status to escalated
        await payservedb.CustomerTicket.findByIdAndUpdate(ticket._id, {
            status: 'escalated',
            sla_status: 'breached',
            assigned_agent_id: escalationTarget.user_id,
            escalated_at: new Date(),
            escalated_to: escalationTarget.user_id,
            escalation_reason: escalationReason,
            $push: {
                interactions: {
                    agent_id: null, // System action
                    message: `Ticket automatically escalated due to SLA breach. ${escalationReason}. Assigned to ${escalationTarget.name} (${escalationTarget.role}).`,
                    is_internal_note: true,
                    created_at: new Date()
                },
                activity_log: {
                    agent_id: null,
                    action: 'auto_escalate',
                    description: `Auto-escalated: ${escalationReason}`,
                    metadata: {
                        minutes_overdue: minutesOverdue,
                        minutes_since_creation: minutesSinceCreation,
                        hours_overdue: hoursOverdue,
                        hours_since_creation: hoursSinceCreation,
                        escalated_to: escalationTarget.agent_id,
                        escalation_target_role: escalationTarget.role
                    },
                    timestamp: new Date()
                }
            }
        });

        // Create notification for escalation target
        await payservedb.AgentNotification.create({
            user_id: escalationTarget.user_id,
            type: 'ticket_escalated_auto',
            title: 'Ticket Auto-Escalated',
            message: `Ticket #${ticket.ticket_number} has been automatically escalated to you due to SLA breach`,
            ticket_id: ticket._id,
            ticket_number: ticket.ticket_number,
            link: `/agent/tickets/${ticket._id}`,
            metadata: {
                escalation_reason: escalationReason,
                minutes_overdue: minutesOverdue,
                hours_overdue: hoursOverdue,
                original_agent: ticket.assigned_agent_id?.fullName || 'Unassigned',
                priority: ticket.category_id?.priority || 'medium'
            }
        });

        // Send SMS and Email notifications
        await sendEscalationNotifications(ticket, escalationTarget, escalationReason);

        // Log auto-escalation in audit
        await logAuditAction(
            ticket._id,
            { userId: null, fullName: 'System', role: 'system' }, // System user
            'auto_escalated',
            {
                old_value: ticket.assigned_agent_id?.fullName || 'Unassigned',
                new_value: escalationTarget.name,
                description: `Automatically escalated: ${escalationReason}`,
                metadata: {
                    escalation_reason: escalationReason,
                    minutes_overdue: minutesOverdue,
                    hours_overdue: hoursOverdue,
                    minutes_since_creation: minutesSinceCreation,
                    hours_since_creation: hoursSinceCreation,
                    escalated_to_role: escalationTarget.role,
                    escalated_to_agent_id: escalationTarget.agent_id,
                    original_agent: ticket.assigned_agent_id?.fullName || 'Unassigned',
                    sla_status: 'breached'
                }
            },
            null // No request object for system actions
        );

        logger.info(`Successfully escalated ticket ${ticket.ticket_number} to ${escalationTarget.name}`);

    } catch (error) {
        logger.error(`Error auto-escalating ticket ${ticket.ticket_number}: ${error.message}`);
    }
}

async function findEscalationTarget(ticket, targetLevel = 3) {
    try {
        const roleCodes = await getRoleCodesForLevel(targetLevel);

        if (roleCodes.length === 0) {
            logger.warn(`No active roles found for level ${targetLevel} — cannot auto-escalate`);
            return null;
        }

        // Get the currently assigned agent's details
        let currentAgent = null;
        if (ticket.assigned_agent_id) {
            currentAgent = await payservedb.Agent.findOne({ user_id: ticket.assigned_agent_id._id }).lean();
        }

        const baseQuery = { status: 'active', role: { $in: roleCodes } };

        // 1. Available agent in same department
        if (currentAgent?.department) {
            const target = await payservedb.Agent.findOne({
                ...baseQuery,
                is_available: true,
                department: currentAgent.department
            }).lean();
            if (target) return target;
        }

        // 2. Any available agent at target level
        const availableTarget = await payservedb.Agent.findOne({
            ...baseQuery,
            is_available: true
        }).lean();
        if (availableTarget) return availableTarget;

        // 3. Any active agent at target level (regardless of availability)
        const anyTarget = await payservedb.Agent.findOne(baseQuery).lean();
        if (anyTarget) return anyTarget;

        logger.warn(`No agents found for level ${targetLevel} (roles: ${roleCodes.join(', ')})`);
        return null;

    } catch (error) {
        logger.error(`Error finding escalation target: ${error.message}`);
        return null;
    }
}

async function sendEscalationNotifications(ticket, escalationTarget, reason) {
    try {
        const agentLoginUrl = process.env.CUSTOMER_OBSESSION_URL || 'https://agent.payserve.co.ke';
        const ticketUrl = `${agentLoginUrl}/tickets/${ticket._id}`;

        const message = `PayServe Agent Portal - Ticket Escalated

URGENT: Ticket Auto-Escalated to You

Ticket #${ticket.ticket_number}
Title: ${ticket.title}
Priority: ${ticket.category_id?.priority || 'N/A'}

Escalation Reason: ${reason}

This ticket requires immediate attention.

View Ticket: ${ticketUrl}

- PayServe Customer Obsession Team`;

        const facility_id = ticket.facility_id || process.env.DEFAULT_SMS_FACILITY_ID || process.env.DFAULT_SMS_FACILITY_ID;

        // Send SMS
        if (escalationTarget.phone) {
            try {
                await sendSms(facility_id, escalationTarget.phone, message);
                logger.info(`Sent escalation SMS to ${escalationTarget.phone}`);
            } catch (smsError) {
                logger.error(`Failed to send escalation SMS: ${smsError.message}`);
            }
        }

        // Send Email
        if (escalationTarget.email) {
            try {
                const emailMessage = `${message}

Additional Details:
- Category: ${ticket.category_id?.name || 'N/A'}
- Status: Escalated
- Created: ${new Date(ticket.created_at).toLocaleString()}
- Customer: ${ticket.customer_id?.fullName || 'N/A'}

Please review and take action immediately.

This is an automated escalation from PayServe Customer Obsession Portal.`;

                await sendEmail(facility_id, escalationTarget.email, 'URGENT: Ticket Auto-Escalated to You', emailMessage);
                logger.info(`Sent escalation email to ${escalationTarget.email}`);
            } catch (emailError) {
                logger.error(`Failed to send escalation email: ${emailError.message}`);
            }
        }

    } catch (error) {
        logger.error(`Error sending escalation notifications: ${error.message}`);
    }
}

async function sendOverdueReminder(ticket, minutesOverdue) {
    try {
        // Check if reminder was sent recently
        const lastReminder = await payservedb.AgentNotification.findOne({
            ticket_id: ticket._id,
            type: 'ticket_overdue'
        }).sort({ created_at: -1 });

        if (lastReminder) {
            const minutesSinceLastReminder = (new Date() - new Date(lastReminder.created_at)) / (1000 * 60);
            if (minutesSinceLastReminder < ESCALATION_CONFIG.REMINDER_INTERVAL_MINUTES) {
                return; // Don't spam with reminders
            }
        }

        // Notify assigned agent if exists, otherwise notify creator
        const agentToNotify = ticket.assigned_agent_id?._id || ticket.created_by_agent_id?._id;

        if (agentToNotify) {
            const hoursOverdue = (minutesOverdue / 60).toFixed(1);

            await payservedb.AgentNotification.create({
                user_id: agentToNotify,
                type: 'ticket_overdue',
                title: 'Ticket SLA Overdue',
                message: `Ticket #${ticket.ticket_number} is ${hoursOverdue}h overdue. Please take action to avoid auto-escalation.`,
                ticket_id: ticket._id,
                ticket_number: ticket.ticket_number,
                link: `/agent/tickets/${ticket._id}`,
                metadata: {
                    minutes_overdue: minutesOverdue,
                    hours_overdue: hoursOverdue,
                    sla_due_date: ticket.sla_due_date,
                    priority: ticket.category_id?.priority
                }
            });

            logger.info(`Sent overdue reminder for ticket ${ticket.ticket_number}`);
        }

    } catch (error) {
        logger.error(`Error sending overdue reminder: ${error.message}`);
    }
}

module.exports = check_overdue_tickets;
