const payservedb = require('payservedb');
const logger = require('../../../../config/winston');
const { logAuditAction, logMultipleAuditActions } = require('../../../utils/ticket_audit');
const { sendSms } = require('../../../utils/send_new_sms');
const { sendEmail } = require('../../../utils/send_new_email');
const crypto = require('crypto');

async function update_ticket(request, reply) {
    try {
        const agent = request.user;
        const { ticket_id } = request.params;
        const {
            title,
            description,
            category_id,
            status,
            tags,
            attachments,
            internal_notes,
            resolution,
            resolution_notes,
            resolved_at,
            customer_satisfaction_rating,
            resolution_time,
            add_interaction
        } = request.body;

        // Validate ticket_id
        if (!ticket_id) {
            return reply.code(400).send({
                success: false,
                error: 'Ticket ID is required'
            });
        }

        // Find existing ticket
        const existingTicket = await payservedb.CustomerTicket.findById(ticket_id)
            .populate('assigned_agent_id', 'fullName firstName lastName email')
            .populate('created_by_agent_id', 'fullName firstName lastName email')
            .populate('category_id', 'name priority color sla_minutes')
            .lean();

        if (!existingTicket) {
            return reply.code(404).send({
                success: false,
                error: 'Ticket not found'
            });
        }

        // Role-based access control
        const canUpdate = checkTicketUpdateAccess(agent, existingTicket);
        if (!canUpdate) {
            return reply.code(403).send({
                success: false,
                error: 'You do not have permission to update this ticket'
            });
        }

        // Prepare update data
        const updateData = {
            updated_at: new Date()
        };

        // Track changes for audit log
        const changes = [];

        // Update allowed fields
        if (title && title !== existingTicket.title) {
            updateData.title = title;
            changes.push({ field: 'title', old_value: existingTicket.title, new_value: title });
        }

        if (description && description !== existingTicket.description) {
            updateData.description = description;
            changes.push({ field: 'description', old_value: existingTicket.description, new_value: description });
        }

        if (category_id && category_id !== existingTicket.category_id?._id?.toString()) {
            // Fetch the new category to get its SLA hours
            const newCategory = await payservedb.TicketCategory.findById(category_id);
            if (!newCategory) {
                return reply.code(404).send({
                    success: false,
                    error: 'Category not found'
                });
            }

            updateData.category_id = category_id;
            changes.push({
                field: 'category',
                old_value: existingTicket.category_id?.name,
                new_value: newCategory.name
            });

            // Recalculate SLA due date based on new category's SLA minutes
            const now = new Date();
            const sla_due_date = new Date(now.getTime() + (newCategory.sla_minutes * 60 * 1000));
            updateData.sla_due_date = sla_due_date;
            changes.push({ field: 'sla_due_date', old_value: existingTicket.sla_due_date, new_value: sla_due_date });
        }

        if (status && status !== existingTicket.status) {
            // Validate status transitions
            const validTransitions = getValidStatusTransitions(existingTicket.status);
            if (!validTransitions.includes(status)) {
                return reply.code(400).send({
                    success: false,
                    error: `Invalid status transition from ${existingTicket.status} to ${status}`
                });
            }

            updateData.status = status;
            changes.push({ field: 'status', old_value: existingTicket.status, new_value: status });

            // Set resolution time and resolved_by if resolved/closed
            if (['resolved', 'closed'].includes(status) && !existingTicket.resolved_at) {
                updateData.resolved_at = new Date();
                updateData.resolved_by = agent.userId;
                updateData.resolution_time = new Date() - new Date(existingTicket.created_at);

                // Generate survey token for customer feedback
                const crypto = require('crypto');
                const surveyToken = crypto.randomBytes(32).toString('hex');
                updateData.survey_token = surveyToken;
                updateData.survey_sent_at = new Date();
            }

            // Handle reopened status - increment counter and set timestamp
            if (status === 'reopened') {
                updateData.reopened_count = (existingTicket.reopened_count || 0) + 1;
                updateData.last_reopened_at = new Date();
                changes.push({
                    field: 'reopened_count',
                    old_value: existingTicket.reopened_count || 0,
                    new_value: updateData.reopened_count
                });
            }
        }

        if (tags && Array.isArray(tags)) {
            updateData.tags = tags;
            changes.push({ field: 'tags', old_value: existingTicket.tags, new_value: tags });
        }

        if (attachments && Array.isArray(attachments)) {
            updateData.attachments = [...(existingTicket.attachments || []), ...attachments];
            changes.push({ field: 'attachments', old_value: existingTicket.attachments, new_value: updateData.attachments });
        }

        if (internal_notes) {
            updateData.internal_notes = internal_notes;
            changes.push({ field: 'internal_notes', old_value: existingTicket.internal_notes, new_value: internal_notes });
        }

        if (resolution && ['resolved', 'closed'].includes(status)) {
            updateData.resolution = resolution;
            changes.push({ field: 'resolution', old_value: existingTicket.resolution, new_value: resolution });
        }

        if (resolution_notes) {
            updateData.resolution_notes = resolution_notes;
            changes.push({ field: 'resolution_notes', old_value: existingTicket.resolution_notes, new_value: resolution_notes });
        }

        if (resolved_at) {
            updateData.resolved_at = new Date(resolved_at);
        }

        if (customer_satisfaction_rating && typeof customer_satisfaction_rating === 'number') {
            if (customer_satisfaction_rating >= 1 && customer_satisfaction_rating <= 5) {
                updateData.customer_rating = customer_satisfaction_rating;
                changes.push({ field: 'customer_rating', old_value: existingTicket.customer_rating, new_value: customer_satisfaction_rating });
            }
        }

        // Handle adding interaction/communication
        if (add_interaction && add_interaction.message) {
            const agentId = agent.userId;
            const is_internal = add_interaction.is_internal_note || false;

            await payservedb.CustomerTicket.findByIdAndUpdate(ticket_id, {
                $push: {
                    interactions: {
                        agent_id: agentId,
                        message: add_interaction.message,
                        is_internal_note: is_internal,
                        tagged_agents: add_interaction.tagged_agents || [],
                        created_at: new Date()
                    }
                }
            });

            // Log interaction in audit
            await logAuditAction(
                ticket_id,
                agent,
                is_internal ? 'agent_note' : 'interaction_added',
                {
                    is_internal,
                    description: is_internal ? 'Added internal note' : 'Added response to ticket',
                    metadata: {
                        message_length: add_interaction.message.length,
                        has_tagged_agents: (add_interaction.tagged_agents || []).length > 0,
                        tagged_count: (add_interaction.tagged_agents || []).length
                    }
                },
                request
            );
            changes.push({ field: 'interaction_added', new_value: add_interaction.message });

            // Create notifications for tagged agents
            if (add_interaction.tagged_agents && add_interaction.tagged_agents.length > 0) {
                const notificationPromises = add_interaction.tagged_agents.map(taggedUserId => {
                    return payservedb.AgentNotification.create({
                        user_id: taggedUserId,
                        type: 'agent_tagged',
                        title: 'You were tagged in a ticket',
                        message: `You were tagged in ticket #${existingTicket.ticket_number}`,
                        ticket_id: ticket_id,
                        ticket_number: existingTicket.ticket_number,
                        link: `/agent/tickets/${ticket_id}`,
                        metadata: {
                            tagged_by: agentId,
                            message_preview: add_interaction.message.substring(0, 100)
                        }
                    });
                });
                await Promise.all(notificationPromises);
            }
        }

        // Update the ticket
        const updatedTicket = await payservedb.CustomerTicket.findByIdAndUpdate(
            ticket_id,
            updateData,
            { new: true, runValidators: true }
        )
        .populate('customer_id', 'fullName firstName lastName email phoneNumber phone unitId address preferences')
        .populate('assigned_agent_id', 'fullName firstName lastName email')
        .populate('created_by_agent_id', 'fullName firstName lastName email')
        .populate('facility_id', 'name company_id address')
        .populate('category_id', 'name priority color sla_minutes')
        .lean();

        // Add activity log for changes
        if (changes.length > 0) {
            await payservedb.CustomerTicket.findByIdAndUpdate(ticket_id, {
                $push: {
                    activity_log: {
                        agent_id: agent.userId,
                        action: 'update',
                        description: `Updated ticket: ${changes.map(c => c.field).join(', ')}`,
                        metadata: { changes },
                        timestamp: new Date()
                    }
                }
            });

            // Add comprehensive audit logs for each change
            const auditActions = changes.map(change => {
                let action = 'updated';

                // Determine specific action type
                if (change.field === 'status') {
                    if (change.new_value === 'resolved') {
                        action = 'resolved';
                    } else if (change.new_value === 'closed') {
                        action = 'closed';
                    } else if (change.new_value === 'reopened') {
                        action = 'reopened';
                    } else if (change.new_value === 'escalated') {
                        action = 'escalated';
                    } else {
                        action = 'status_changed';
                    }
                } else if (change.field === 'assigned_agent_id') {
                    action = change.old_value ? 'reassigned' : 'assigned';
                } else if (change.field === 'category_id') {
                    action = 'category_changed';
                } else if (change.field === 'sla_due_date') {
                    action = 'sla_updated';
                }

                return {
                    action,
                    field_changed: change.field,
                    old_value: change.old_value,
                    new_value: change.new_value,
                    metadata: {
                        change_context: change.field,
                        reopened_count: change.field === 'status' && change.new_value === 'reopened'
                            ? existingTicket.reopened_count + 1
                            : undefined
                    }
                };
            });

            await logMultipleAuditActions(ticket_id, agent, auditActions, request);
        }

        // Add interaction for status changes
        if (changes.some(change => change.field === 'status')) {
            await payservedb.CustomerTicket.findByIdAndUpdate(ticket_id, {
                $push: {
                    interactions: {
                        agent_id: agent.userId,
                        message: `Ticket status updated from ${existingTicket.status} to ${status}${resolution_notes ? `. Notes: ${resolution_notes}` : ''}`,
                        is_internal_note: true,
                        created_at: new Date()
                    }
                }
            });

            // Send notification to creating agent when ticket is resolved
            if (['resolved', 'closed'].includes(status)) {
                const creatingAgentId = existingTicket.created_by_agent_id?._id?.toString();
                const resolvingAgentId = agent.userId;

                // Only notify if the resolving agent is different from the creating agent
                if (creatingAgentId && creatingAgentId !== resolvingAgentId) {
                    await payservedb.AgentNotification.create({
                        user_id: creatingAgentId,
                        type: 'ticket_resolved',
                        title: 'Ticket Resolved',
                        message: `Ticket #${existingTicket.ticket_number} has been ${status}`,
                        ticket_id: ticket_id,
                        ticket_number: existingTicket.ticket_number,
                        link: `/agent/tickets/${ticket_id}`,
                        metadata: {
                            resolved_by: resolvingAgentId,
                            resolution: resolution || 'No resolution notes provided',
                            resolution_notes: resolution_notes
                        }
                    });
                }

                // Send resolution notification to customer and create survey
                await sendCustomerResolutionNotificationAndSurvey(
                    updatedTicket,
                    resolution_notes,
                    agent
                );
            }

            // Send notification to assigned agent when ticket is reopened
            if (status === 'reopened') {
                const assignedAgentId = existingTicket.assigned_agent_id?._id?.toString();
                const reopeningAgentId = agent.userId;

                // Notify assigned agent if different from reopening agent
                if (assignedAgentId && assignedAgentId !== reopeningAgentId) {
                    await payservedb.AgentNotification.create({
                        user_id: assignedAgentId,
                        type: 'ticket_reopened',
                        title: 'Ticket Reopened',
                        message: `Ticket #${existingTicket.ticket_number} has been reopened`,
                        ticket_id: ticket_id,
                        ticket_number: existingTicket.ticket_number,
                        link: `/agent/tickets/${ticket_id}`,
                        metadata: {
                            reopened_by: reopeningAgentId,
                            reopened_count: (existingTicket.reopened_count || 0) + 1,
                            previous_status: existingTicket.status
                        }
                    });
                }

                // Also notify the creating agent if different from both
                const creatingAgentId = existingTicket.created_by_agent_id?._id?.toString();
                if (creatingAgentId && creatingAgentId !== reopeningAgentId && creatingAgentId !== assignedAgentId) {
                    await payservedb.AgentNotification.create({
                        user_id: creatingAgentId,
                        type: 'ticket_reopened',
                        title: 'Ticket Reopened',
                        message: `Ticket #${existingTicket.ticket_number} you created has been reopened`,
                        ticket_id: ticket_id,
                        ticket_number: existingTicket.ticket_number,
                        link: `/agent/tickets/${ticket_id}`,
                        metadata: {
                            reopened_by: reopeningAgentId,
                            reopened_count: (existingTicket.reopened_count || 0) + 1,
                            previous_status: existingTicket.status
                        }
                    });
                }
            }
        }

        // Calculate SLA status
        const now = new Date();
        const sla_due = updatedTicket.sla_due_date ? new Date(updatedTicket.sla_due_date) : null;
        let sla_status = 'on_time';
        let time_remaining = null;

        if (sla_due) {
            time_remaining = sla_due.getTime() - now.getTime();
            if (time_remaining < 0) {
                sla_status = 'overdue';
            } else if (time_remaining < (2 * 60 * 60 * 1000)) {
                sla_status = 'at_risk';
            }
        }

        // Send notifications for status changes (placeholder)
        // if (changes.some(change => change.field === 'status')) {
        //     await sendTicketNotifications(ticket_id, 'status_changed', status);
        // }

        logger.info(`Agent ${agent.agent.agent_id} updated ticket ${existingTicket.ticket_number} with ${changes.length} changes`);

        const response = {
            ...updatedTicket,
            sla_status,
            time_remaining: Math.max(0, time_remaining || 0),
            changes_made: changes
        };

        return reply.code(200).send({
            success: true,
            message: 'Ticket updated successfully',
            data: response
        });

    } catch (error) {
        logger.error(`Error updating ticket: ${error.message}`);
        return reply.code(500).send({
            success: false,
            error: 'Failed to update ticket'
        });
    }
}

// Helper function to check ticket update permissions
function checkTicketUpdateAccess(agent, ticket) {
    const role = agent.agent?.role;
    const agentId = agent.userId;

    // Managers can update all tickets
    if (role === 'manager') return true;

    // Team leaders/supervisors can update their team's tickets
    if (['team_leader', 'supervisor'].includes(role)) {
        if (agentId === ticket.assigned_agent_id?._id?.toString()) return true;
        if (agentId === ticket.created_by_agent_id?._id?.toString()) return true;
    }

    // Agents can update their own assigned or created tickets
    if (role === 'call_center_agent' || role === 'agent') {
        if (agentId === ticket.assigned_agent_id?._id?.toString()) return true;
        if (agentId === ticket.created_by_agent_id?._id?.toString()) return true;
    }

    return false;
}

// Helper function to get valid status transitions
function getValidStatusTransitions(currentStatus) {
    const transitions = {
        'open': ['in_progress', 'assigned', 'closed'],
        'assigned': ['in_progress', 'escalated', 'closed'],
        'in_progress': ['resolved', 'escalated', 'on_hold', 'closed'],
        'on_hold': ['in_progress', 'resolved', 'closed'],
        'escalated': ['in_progress', 'resolved', 'closed'],
        'resolved': ['closed', 'reopened'],
        'closed': ['reopened'],
        'reopened': ['in_progress', 'resolved', 'closed'],
        'overdue': ['in_progress', 'resolved', 'escalated', 'closed']
    };

    return transitions[currentStatus] || [];
}

// Helper function to send customer resolution notification and create satisfaction survey
async function sendCustomerResolutionNotificationAndSurvey(ticket, resolution_notes, agent) {
    try {
        const customer = ticket.customer_id;
        const ticketNumber = ticket.ticket_number;
        const categoryName = ticket.category_id?.name || 'Support Issue';
        const facilityId = ticket.facility_id?._id || ticket.facility_id;

        // Check if there's a custom caller - send survey to them instead
        const hasCustomCaller = ticket.custom_caller && ticket.custom_caller.name;

        const recipientName = hasCustomCaller
            ? ticket.custom_caller.name
            : (customer.fullName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Valued Customer');

        const recipientPhone = hasCustomCaller
            ? ticket.custom_caller.phone
            : (customer.phoneNumber || customer.phone);

        const recipientEmail = hasCustomCaller
            ? ticket.custom_caller.email
            : customer.email;

        const customerName = customer.fullName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Valued Customer';

        // Generate unique survey token
        const surveyToken = crypto.randomBytes(32).toString('hex');

        // Set survey expiration (7 days from now)
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 7);

        // Create survey record in database
        try {
            const surveyData = {
                ticket_id: ticket._id,
                ticket_number: ticketNumber,
                customer_id: customer._id,
                facility_id: facilityId,
                assigned_agent_id: ticket.assigned_agent_id?._id || ticket.assigned_agent_id,
                survey_token: surveyToken,
                status: 'pending',
                sent_at: new Date(),
                expired_at: expirationDate
            };

            // Add custom caller info if present
            if (hasCustomCaller) {
                surveyData.custom_caller = {
                    name: ticket.custom_caller.name,
                    phone: ticket.custom_caller.phone,
                    email: ticket.custom_caller.email,
                    relationship: ticket.custom_caller.relationship
                };
            }

            await payservedb.CustomerSatisfactionSurvey.create(surveyData);

            logger.info(`Customer satisfaction survey created for ticket ${ticketNumber} with token ${surveyToken}${hasCustomCaller ? ' (sent to custom caller)' : ''}`);
        } catch (surveyError) {
            logger.error(`Failed to create survey for ticket ${ticketNumber}: ${surveyError.message}`);
            // Continue with notification even if survey creation fails
        }

        // Build survey URL - smart detection based on backend URL
        // Survey is on customer obsession portal (agent portal), not resident portal
        let surveyBaseUrl;
        const backendUrl = process.env.BACKEND_URL || '';

        if (backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1')) {
            // Local development
            surveyBaseUrl = process.env.CUSTOMER_OBSESSION_PORTAL_URL_LOCAL || 'http://localhost:3000';
        } else if (backendUrl.includes('sandbox')) {
            // Sandbox environment
            surveyBaseUrl = process.env.CUSTOMER_OBSESSION_PORTAL_URL_SANDBOX || 'https://cop.sandbox.payserve.co.ke';
        } else {
            // Production environment
            surveyBaseUrl = process.env.CUSTOMER_OBSESSION_PORTAL_URL || 'https://cop.payserve.co.ke';
        }

        const surveyUrl = `${surveyBaseUrl}/survey/${surveyToken}`;

        // Prepare resolution summary
        const resolutionSummary = resolution_notes || 'Your issue has been resolved by our support team.';

        // SMS Message - brief and concise to save costs
        const smsMessage = hasCustomCaller
            ? `Hi ${recipientName}, ticket #${ticketNumber} for ${customerName} is resolved. Rate our service: ${surveyUrl} - PayServe`
            : `Hi ${recipientName}, your ticket #${ticketNumber} is resolved. Rate our service: ${surveyUrl} - PayServe`;

        // Email Message - personalized for caller or customer
        const emailSubject = `Ticket #${ticketNumber} Resolved - Please Share Your Feedback`;
        const emailIntro = hasCustomCaller
            ? `Dear ${recipientName},\n\nGood news! The support ticket for ${customerName} has been successfully resolved.`
            : `Dear ${recipientName},\n\nGood news! Your support ticket has been successfully resolved.`;

        const emailMessage = `${emailIntro}

Ticket Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ticket Number: #${ticketNumber}
Category: ${categoryName}
Status: Resolved
Resolved By: ${agent.fullName || agent.firstName || 'Support Team'}

Resolution Summary:
${resolutionSummary}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOUR FEEDBACK MATTERS! 🌟

We're committed to providing excellent customer service, and your feedback helps us improve. Please take just 2 minutes to complete our satisfaction survey:

👉 ${surveyUrl}

The survey will help us understand:
✓ How satisfied you are with the resolution
✓ The quality of our support team's service
✓ How we can serve you better in the future

Note: This survey link expires on ${expirationDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
})}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Still Have Questions?
If you have any additional concerns or if the issue persists, please don't hesitate to reach out to us again through the customer portal.

Track Your Tickets: ${surveyBaseUrl}

Thank you for choosing PayServe!

Best regards,
PayServe Customer Support Team

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is an automated message from PayServe Customer Obsession System.`;

        // Send SMS notification
        if (recipientPhone) {
            try {
                await sendSms(facilityId, recipientPhone, smsMessage);
                logger.info(`Resolution notification SMS sent to ${hasCustomCaller ? 'custom caller' : 'customer'} for ticket ${ticketNumber}`);
            } catch (smsError) {
                logger.error(`Failed to send resolution SMS for ticket ${ticketNumber}: ${smsError.message}`);
            }
        }

        // Send Email notification
        if (recipientEmail) {
            try {
                await sendEmail(facilityId, recipientEmail, emailSubject, emailMessage);
                logger.info(`Resolution notification email sent to ${hasCustomCaller ? 'custom caller' : 'customer'} for ticket ${ticketNumber}`);
            } catch (emailError) {
                logger.error(`Failed to send resolution email for ticket ${ticketNumber}: ${emailError.message}`);
            }
        }

        logger.info(`Customer resolution notification and survey sent for ticket ${ticketNumber}`);

    } catch (error) {
        logger.error(`Error sending customer resolution notification: ${error.message}`);
        // Don't throw - notification failure should not break ticket resolution
    }
}

module.exports = update_ticket;