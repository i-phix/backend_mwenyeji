const payservedb = require('payservedb');
const logger = require('../../../../../config/winston');
const bcrypt = require('bcryptjs');
const { sendSms } = require('../../../../utils/send_new_sms');
const { sendEmail } = require('../../../../utils/send_new_email');

const reset_password = async (request, reply) => {
    try {
        const { id } = request.params;

        if (!id) {
            return reply.code(400).send({
                error: 'Agent ID is required'
            });
        }

        // Find the agent
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

        // Check if agent is active
        if (agent.status !== 'active' && agent.status !== 'inactive') {
            return reply.code(400).send({
                error: 'Cannot reset password for suspended or terminated agent'
            });
        }

        // Get the associated user record
        const user = await payservedb.User.findById(agent.user_id);
        if (!user) {
            return reply.code(404).send({
                error: 'Associated user account not found'
            });
        }

        // Generate new temporary password
        const newTempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(newTempPassword, 10);

        // Update the User model with new password (not Agent model)
        await payservedb.User.findByIdAndUpdate(
            user._id,
            {
                password: hashedPassword,
                updatedAt: new Date()
            }
        );

        // Update agent record with reset tracking
        const updatedAgent = await payservedb.Agent.findByIdAndUpdate(
            agent._id,
            {
                updated_at: new Date()
            },
            { new: true }
        ).populate('user_id', 'fullName email phoneNumber');

        // Log password reset action for audit
        logger.info(`Password reset initiated for agent: ${agent.agent_id} by ${request.user?.agent?.agent_id || 'system'}`);

        // Prepare credentials message
        const agentLoginUrl = process.env.CUSTOMER_OBSESSION_URL || 'https://agent.payserve.co.ke';
        const corePortalUrl = process.env.CORE_PORTAL_URL || 'https://core.payserve.co.ke';
        const resetPasswordUrl = `${corePortalUrl}/reset_password/${user._id}`;

        const credentialsMessage = `PayServe Password Reset

Agent ID: ${agent.agent_id}
New Password: ${newTempPassword}

Login: ${agentLoginUrl}

Change password immediately.`;

        // Use facility_id if available, otherwise use default
        const communicationFacilityId = agent.facility_id || process.env.DEFAULT_SMS_FACILITY_ID || process.env.DFAULT_SMS_FACILITY_ID;

        // Track notification status
        let smsStatus = { sent: false, error: null };
        let emailStatus = { sent: false, error: null };

        // Send SMS notification
        try {
            const phoneNumber = agent.phone || user.phoneNumber;
            if (phoneNumber) {
                logger.info(`Sending password reset SMS to ${phoneNumber} for agent ${agent.agent_id}`);
                await sendSms(communicationFacilityId, phoneNumber, credentialsMessage);
                logger.info(`Password reset SMS sent successfully to ${phoneNumber}`);
                smsStatus.sent = true;
            } else {
                logger.warn(`No phone number found for agent ${agent.agent_id}, skipping SMS`);
                smsStatus.error = 'No phone number available';
            }
        } catch (smsError) {
            logger.error(`Failed to send password reset SMS to agent ${agent.agent_id}:`, smsError.message);
            smsStatus.error = smsError.message;
        }

        // Send Email notification with more details
        const emailSubject = 'PayServe Agent Portal - Password Reset';
        const emailMessage = `${credentialsMessage}

Additional Information:
- Your account status: ${agent.status}
- Department: ${agent.department}
- Role: ${agent.role}

Security Tips:
- Never share your password with anyone
- Use a strong, unique password
- Change your password regularly
- Contact your supervisor if you didn't request this reset

This is an automated message from PayServe Customer Obsession Portal.`;

        try {
            const emailAddress = agent.email || user.email;
            if (emailAddress) {
                logger.info(`Sending password reset email to ${emailAddress} for agent ${agent.agent_id}`);
                await sendEmail(communicationFacilityId, emailAddress, emailSubject, emailMessage);
                logger.info(`Password reset email sent successfully to ${emailAddress}`);
                emailStatus.sent = true;
            } else {
                logger.warn(`No email address found for agent ${agent.agent_id}, skipping email`);
                emailStatus.error = 'No email address available';
            }
        } catch (emailError) {
            logger.error(`Failed to send password reset email to agent ${agent.agent_id}:`, emailError.message);
            emailStatus.error = emailError.message;
        }

        // Build response message
        let successMessage = 'Password reset successfully';
        if (smsStatus.sent && emailStatus.sent) {
            successMessage += '. New credentials sent via SMS and email';
        } else if (smsStatus.sent) {
            successMessage += '. New credentials sent via SMS';
        } else if (emailStatus.sent) {
            successMessage += '. New credentials sent via email';
        } else {
            successMessage += '. Note: Failed to send credentials via SMS and email';
        }

        logger.info(`Password reset completed successfully for agent: ${agent.agent_id}`);

        return reply.code(200).send({
            success: true,
            message: successMessage,
            agent: updatedAgent,
            tempPassword: newTempPassword, // Include for admin reference
            notifications: {
                sms: smsStatus,
                email: emailStatus
            }
        });

    } catch (err) {
        logger.error(`Error resetting password: ${err.message}`);
        console.log(err);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = reset_password;