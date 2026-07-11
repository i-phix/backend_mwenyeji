const payservedb = require("payservedb");
const logger = require('../../../../../config/winston');
const bcrypt = require('bcryptjs');
const { sendSms } = require('../../../../utils/send_new_sms');
const { sendEmail } = require("../../../../utils/send_new_email");

const add_agent = async (request, reply) => {
    try {
        let {
            firstName,
            lastName,
            email,
            phoneNumber,
            idNumber,
            department,
            team_id,
            facility_id,
            role,
            status
        } = request.body;

        logger.info("Creating agent - Request body:", request.body);

        // Validate required fields
        if (!firstName || !lastName || !email || !phoneNumber || !idNumber) {
            logger.error("Validation failed - Missing required fields:", { firstName, lastName, email, phoneNumber, idNumber });
            return reply.code(400).send({
                success: false,
                error: 'firstName, lastName, email, phoneNumber, and idNumber are required fields'
            });
        }

        // Validate department and role are required
        if (!department || !department.trim()) {
            logger.error("Validation failed - Department is required");
            return reply.code(400).send({
                success: false,
                error: 'Department is required'
            });
        }

        if (!role) {
            logger.error("Validation failed - Role is required");
            return reply.code(400).send({
                success: false,
                error: 'Role is required'
            });
        }

        // Validate role exists in AgentRole collection
        const roleDoc = await payservedb.AgentRole.findOne({ code: role.toLowerCase() });
        if (!roleDoc) {
            logger.error("Validation failed - Role not found in AgentRole collection:", role);
            return reply.code(400).send({
                success: false,
                error: 'Invalid role. Please create the role in the Departments & Roles tab first.'
            });
        }

        // Validate department if role has a department assigned
        if (roleDoc.department && department) {
            const deptDoc = await payservedb.AgentDepartment.findById(roleDoc.department);
            if (deptDoc && deptDoc.code.toUpperCase() !== department.toUpperCase()) {
                logger.warn(`Role ${role} is assigned to department ${deptDoc.code}, but agent is being assigned to ${department}`);
            }
        }

        // Validate and capitalize names (only letters and spaces allowed)
        const nameRegex = /^[a-zA-Z\s]+$/;
        if (!nameRegex.test(firstName) || !nameRegex.test(lastName)) {
            logger.error("Validation failed - Invalid name format");
            return reply.code(400).send({
                error: 'Names should only contain letters and spaces'
            });
        }

        // Capitalize first letter of each word in names
        const capitalizeName = (name) => {
            return name.split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
        };

        firstName = capitalizeName(firstName.trim());
        lastName = capitalizeName(lastName.trim());

        logger.info("Validation passed, checking for existing email:", email);

        // Check if email already exists
        const existingAgent = await payservedb.Agent.findOne({ email: email });
        if (existingAgent) {
            logger.error("Agent with email already exists:", email);
            return reply.code(409).send({
                error: 'An agent with this email already exists'
            });
        }

        // Check if user exists in main User collection
        const existingUser = await payservedb.User.findOne({ email: email });
        if (existingUser) {
            logger.error("User with email already exists in system:", email);
            return reply.code(409).send({
                error: 'A user with this email already exists in the system'
            });
        }

        logger.info("Email check passed, creating new agent");

        // Generate temporary password
        const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        // Create user record first for user_id reference
        const userRecord = {
            fullName: `${firstName} ${lastName}`,
            email,
            phoneNumber,
            idNumber, // Store ID/Passport number in User model
            type: 'Customer_Support', // Customer_Support type for agents to enable login flow
            role: 'user', // Valid enum value from User schema
            password: hashedPassword
        };

        const newUser = new payservedb.User(userRecord);
        const savedUser = await newUser.save();

        // Generate agent ID using schema method (PS25XXXX format)
        const agentId = payservedb.Agent.generateAgentId();

        // Create agent record compatible with schema
        const agentRecord = {
            agent_id: agentId,
            user_id: savedUser._id,
            name: `${firstName} ${lastName}`, // Schema expects 'name' field
            email,
            phone: phoneNumber, // Schema expects 'phone' field
            id_number: idNumber, // Required field
            role: roleDoc.code, // Use role code from AgentRole collection
            department,
            status: status || 'active', // Use provided status or default
            permissions: roleDoc.permissions || [] // Set permissions from role
        };

        // Only add team_id if provided and not empty
        if (team_id && team_id.trim() !== '') {
            agentRecord.team_id = team_id;
        }

        // Only add facility_id if provided (agents work across facilities)
        if (facility_id) {
            agentRecord.facility_id = facility_id;
        }

        const newAgent = new payservedb.Agent(agentRecord);

        const savedAgent = await newAgent.save();

        logger.info(`Agent created successfully. Agent ID: ${agentId}, Temporary password: ${tempPassword}`);

        // Send SMS and Email with credentials
        const agentLoginUrl = process.env.CUSTOMER_OBSESSION_URL || 'https://agent.payserve.co.ke';
        const corePortalUrl = process.env.CORE_PORTAL_URL || 'https://core.payserve.co.ke';
        const resetPasswordUrl = `${corePortalUrl}/reset_password/${savedUser._id}`;

        // Prepare credentials message - SHORT VERSION FOR SMS
        const credentialsMessage = `PayServe Agent Portal

Agent ID: ${agentId}
Email: ${email}
Password: ${tempPassword}

Login: ${agentLoginUrl}

Change password after first login.`;

        // Use facility_id if provided, otherwise use a default facility ID for agent communications
        const communicationFacilityId = facility_id || process.env.DEFAULT_SMS_FACILITY_ID || process.env.DFAULT_SMS_FACILITY_ID;

        // Track notification status
        let smsStatus = { sent: false, error: null };
        let emailStatus = { sent: false, error: null };

        // Send SMS
        try {
            logger.info(`Sending SMS to ${phoneNumber} for agent ${agentId}`);
            await sendSms(communicationFacilityId, phoneNumber, credentialsMessage);
            logger.info(`SMS sent successfully to ${phoneNumber}`);
            smsStatus.sent = true;
        } catch (smsError) {
            logger.error(`Failed to send SMS to ${phoneNumber}:`, smsError.message);
            smsStatus.error = smsError.message;
            // Don't fail the agent creation if SMS fails - just log it
        }

        // Send Email with more detailed instructions
        const emailSubject = 'PayServe Agent Portal - Your Account Credentials';
        const emailMessage = `${credentialsMessage}

Additional Information:
- Your permissions are based on your role: ${roleDoc.name}
- Department: ${department}
${team_id ? `- Team ID: ${team_id}` : ''}
- Status: ${status || 'active'}

System Features:
- Ticket Management
- Customer Communication
- Knowledge Base Access
- Real-time Notifications

Need help getting started?
Contact your team leader or supervisor for onboarding assistance.

This is an automated message from PayServe Customer Obsession Portal.`;

        try {
            logger.info(`Sending email to ${email} for agent ${agentId}`);
            await sendEmail(communicationFacilityId, email, emailSubject, emailMessage);
            logger.info(`Email sent successfully to ${email}`);
            emailStatus.sent = true;
        } catch (emailError) {
            logger.error(`Failed to send email to ${email}:`, emailError.message);
            emailStatus.error = emailError.message;
            // Don't fail the agent creation if email fails - just log it
        }

        // Create response with agent and user info
        const agentResponse = savedAgent.toObject();

        // Build success message based on notification status
        let successMessage = 'Agent created successfully';
        if (smsStatus.sent && emailStatus.sent) {
            successMessage += '. Credentials sent via SMS and email';
        } else if (smsStatus.sent) {
            successMessage += '. Credentials sent via SMS';
        } else if (emailStatus.sent) {
            successMessage += '. Credentials sent via email';
        } else {
            successMessage += '. Note: Failed to send credentials via SMS and email';
        }

        const responseData = {
            success: true,
            message: successMessage,
            agent: agentResponse,
            user: {
                _id: savedUser._id,
                fullName: savedUser.fullName,
                email: savedUser.email,
                phoneNumber: savedUser.phoneNumber
            },
            tempPassword: tempPassword, // Include in response for admin reference
            notifications: {
                sms: smsStatus,
                email: emailStatus
            }
        };

        logger.info("Agent created successfully");
        logger.info("Sending response:", {
            success: responseData.success,
            agentId: responseData.agent.agent_id,
            email: responseData.agent.email
        });

        return reply.code(200).send(responseData);

    } catch (err) {
        console.error('Add agent error:', err);
        logger.error('Add agent failed:', err.message);
        logger.error('Stack trace:', err.stack);
        return reply.code(500).send({
            success: false,
            error: err.message,
            details: err.stack
        });
    }
};

module.exports = add_agent;