const payservedb = require('payservedb');
const logger = require('../../../../../config/winston');
const { sendSms } = require('../../../../utils/send_new_sms');
const { sendEmail } = require('../../../../utils/send_new_email');

const update_agent_status = async (request, reply) => {
    try {
        const { id } = request.params;
        const { status, reason, effective_date } = request.body;

        if (!id) {
            return reply.code(400).send({
                error: 'Agent ID is required'
            });
        }

        if (!status) {
            return reply.code(400).send({
                error: 'Status is required'
            });
        }

        // Validate status
        const validStatuses = ['active', 'inactive', 'suspended', 'training', 'terminated'];
        if (!validStatuses.includes(status)) {
            return reply.code(400).send({
                error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        // Find the agent with user details
        const agent = await payservedb.Agent.findOne({
            $or: [
                { _id: id },
                { agent_id: id }
            ]
        }).populate('user_id', 'fullName email phoneNumber');

        if (!agent) {
            return reply.code(404).send({
                error: 'Agent not found'
            });
        }

        // If terminating agent, check for active tickets
        if (status === 'terminated') {
            const activeTickets = await payservedb.CustomerTicket.countDocuments({
                assigned_agent_id: agent.user_id._id,
                status: { $in: ['open', 'in_progress', 'escalated', 'reopened', 'on_hold'] }
            });

            if (activeTickets > 0) {
                return reply.code(400).send({
                    success: false,
                    error: `Cannot terminate agent. Agent has ${activeTickets} active ticket(s). Please reassign all tickets before termination.`,
                    activeTickets
                });
            }
        }

        // If suspending agent, warn about active tickets
        if (status === 'suspended') {
            const activeTickets = await payservedb.CustomerTicket.countDocuments({
                assigned_agent_id: agent.user_id._id,
                status: { $in: ['open', 'in_progress', 'escalated', 'reopened', 'on_hold'] }
            });

            if (activeTickets > 0) {
                logger.warn(`Suspending agent ${agent.agent_id} with ${activeTickets} active ticket(s)`);
            }
        }

        // Track status change history
        const statusChangeHistory = {
            previous_status: agent.status,
            new_status: status,
            changed_by: request.user?.userId || 'system',
            changed_at: new Date(),
            reason: reason || 'Status update',
            effective_date: effective_date ? new Date(effective_date) : new Date()
        };

        // Prepare update data
        const updateData = {
            status,
            status_changed_at: new Date(),
            status_changed_by: request.user?.userId || 'system',
            previous_status: agent.status,
            updated_by: request.user?.userId || 'system',
            updatedAt: new Date(),
            $push: {
                status_history: statusChangeHistory
            }
        };

        // Handle specific status changes
        switch (status) {
            case 'terminated':
                updateData.terminated_at = new Date();
                updateData.terminated_by = request.user?.userId || 'system';
                updateData.terminated_reason = reason || 'No reason provided';
                updateData.is_available = false;
                break;
            case 'suspended':
                updateData.suspended_at = new Date();
                updateData.suspended_by = request.user?.userId || 'system';
                updateData.suspended_reason = reason || 'No reason provided';
                updateData.is_available = false;
                break;
            case 'active':
                // Clear suspension data if returning to active
                if (agent.status === 'suspended') {
                    updateData.$unset = {
                        suspended_at: 1,
                        suspended_by: 1,
                        suspended_reason: 1
                    };
                }
                updateData.is_available = true;
                break;
            case 'inactive':
                updateData.is_available = false;
                break;
        }

        // Update the agent
        const updatedAgent = await payservedb.Agent.findByIdAndUpdate(
            agent._id,
            updateData,
            { new: true, runValidators: true }
        )
        .select('-password');

        // Log the status change
        logger.info(`Agent status updated successfully: ${updatedAgent.agent_id} - ${agent.status} -> ${status} by ${request.user?.agent?.agent_id || 'system'}`);

        // Send status change notifications via SMS and Email
        const agentLoginUrl = process.env.CUSTOMER_OBSESSION_URL || 'https://agent.payserve.co.ke';
        const user = agent.user_id;
        const agentName = user?.fullName || agent.name;

        let smsStatus = { sent: false, error: null };
        let emailStatus = { sent: false, error: null };

        let notificationMessage = '';
        let emailSubject = '';

        switch (status) {
            case 'terminated':
                emailSubject = 'Account Terminated - PayServe Agent Portal';
                notificationMessage = `PayServe Agent Portal - Account Terminated

Dear ${agentName},

Your agent account has been terminated.

Agent ID: ${agent.agent_id}
Termination Date: ${new Date().toLocaleDateString()}
Reason: ${reason || 'Administrative decision'}

Your access to the agent portal has been revoked.
Please contact HR for any questions regarding this change.

- PayServe Customer Obsession Team`;
                break;

            case 'suspended':
                emailSubject = 'Account Suspended - PayServe Agent Portal';
                notificationMessage = `PayServe Agent Portal - Account Suspended

Dear ${agentName},

Your account has been suspended.

Agent ID: ${agent.agent_id}
Suspension Date: ${new Date().toLocaleDateString()}
Reason: ${reason || 'Administrative decision'}

Your access to the agent portal is temporarily restricted.
Please contact your supervisor for more information.

- PayServe Customer Obsession Team`;
                break;

            case 'active':
                if (agent.status === 'suspended' || agent.status === 'inactive') {
                    emailSubject = 'Account Reactivated - PayServe Agent Portal';
                    notificationMessage = `PayServe Agent Portal - Account Reactivated

Dear ${agentName},

Your agent account has been reactivated!

Agent ID: ${agent.agent_id}
Reactivation Date: ${new Date().toLocaleDateString()}

You can now log in to the agent portal:
${agentLoginUrl}

Welcome back!

- PayServe Customer Obsession Team`;
                }
                break;
        }

        // Send notifications if there's a message
        if (notificationMessage) {
            const communicationFacilityId = agent.facility_id || process.env.DEFAULT_SMS_FACILITY_ID || process.env.DFAULT_SMS_FACILITY_ID;

            // Send SMS
            try {
                const phoneNumber = agent.phone || user?.phoneNumber;
                if (phoneNumber) {
                    logger.info(`Sending status change SMS to ${phoneNumber} for agent ${agent.agent_id}`);
                    await sendSms(communicationFacilityId, phoneNumber, notificationMessage);
                    logger.info(`Status change SMS sent successfully`);
                    smsStatus.sent = true;
                } else {
                    smsStatus.error = 'No phone number available';
                }
            } catch (smsError) {
                logger.error(`Failed to send status change SMS: ${smsError.message}`);
                smsStatus.error = smsError.message;
            }

            // Send Email
            try {
                const emailAddress = agent.email || user?.email;
                if (emailAddress) {
                    logger.info(`Sending status change email to ${emailAddress} for agent ${agent.agent_id}`);
                    const emailMessage = `${notificationMessage}

Additional Information:
- Previous Status: ${agent.status}
- New Status: ${status}
- Department: ${agent.department}
- Role: ${agent.role}

For assistance, contact your supervisor or HR department.

This is an automated message from PayServe Customer Obsession Portal.`;

                    await sendEmail(communicationFacilityId, emailAddress, emailSubject, emailMessage);
                    logger.info(`Status change email sent successfully`);
                    emailStatus.sent = true;
                } else {
                    emailStatus.error = 'No email address available';
                }
            } catch (emailError) {
                logger.error(`Failed to send status change email: ${emailError.message}`);
                emailStatus.error = emailError.message;
            }
        }

        return reply.code(200).send({
            success: true,
            message: 'Agent status updated successfully',
            agent: updatedAgent,
            statusChange: statusChangeHistory,
            notifications: {
                sms: smsStatus,
                email: emailStatus
            }
        });

    } catch (err) {
        logger.error(`Error updating agent status: ${err.message}`);
        console.log(err);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = update_agent_status;