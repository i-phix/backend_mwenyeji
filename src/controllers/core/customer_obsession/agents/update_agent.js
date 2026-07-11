const payservedb = require('payservedb');
const logger = require('../../../../../config/winston');

const update_agent = async (request, reply) => {
    try {
        const { id } = request.params;
        let {
            firstName,
            lastName,
            email,
            phoneNumber,
            idNumber,
            department,
            team_id,
            role,
            status,
            shift_hours,
            skills,
            languages
        } = request.body;

        logger.info('Update agent request received:', {
            id,
            body: request.body,
            fields: {
                firstName,
                lastName,
                email,
                phoneNumber,
                idNumber,
                department,
                team_id,
                role,
                status,
                shift_hours,
                skills,
                languages
            }
        });

        if (!id) {
            return reply.code(400).send({
                error: 'Agent ID is required'
            });
        }

        // Validate required fields
        if (!firstName || !lastName || !email || !phoneNumber || !idNumber) {
            logger.error("Validation failed - Missing required fields:", { firstName, lastName, email, phoneNumber, idNumber });
            return reply.code(400).send({
                error: 'firstName, lastName, email, phoneNumber, and idNumber are required fields'
            });
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

        // Find the agent
        const agent = await payservedb.Agent.findOne({
            $or: [
                { _id: id },
                { agent_id: id }
            ]
        });

        if (!agent) {
            return reply.code(404).send({
                error: 'Agent not found'
            });
        }

        // If email is being updated, check for duplicates
        if (email && email !== agent.email) {
            const existingAgent = await payservedb.Agent.findOne({
                email: email,
                _id: { $ne: agent._id }
            });

            if (existingAgent) {
                return reply.code(409).send({
                    error: 'An agent with this email already exists'
                });
            }

            // Also check in main User collection
            const existingUser = await payservedb.User.findOne({ email: email });
            if (existingUser) {
                return reply.code(409).send({
                    error: 'A user with this email already exists in the system'
                });
            }
        }

        // Prepare update data
        const updateData = {
            updated_by: request.user?.userId || 'system',
            updatedAt: new Date()
        };

        // Only update fields that are provided
        // Combine firstName and lastName into name field that schema expects
        if (firstName !== undefined || lastName !== undefined) {
            const currentFirstName = firstName !== undefined ? firstName : '';
            const currentLastName = lastName !== undefined ? lastName : '';
            updateData.name = `${currentFirstName} ${currentLastName}`.trim();
        }
        if (email !== undefined) updateData.email = email;
        if (phoneNumber !== undefined) updateData.phone = phoneNumber;
        if (idNumber !== undefined) updateData.id_number = idNumber;
        if (department !== undefined) updateData.department = department;
        if (team_id !== undefined && team_id !== '' && team_id.trim() !== '') updateData.team_id = team_id;
        if (role !== undefined) updateData.role = role;
        if (status !== undefined) updateData.status = status;
        if (shift_hours !== undefined) updateData.shift_hours = shift_hours;
        if (skills !== undefined) updateData.skills = skills;
        if (languages !== undefined) updateData.languages = languages;

        logger.info('Update data prepared:', updateData);

        // If status is being changed to inactive/terminated, record the change
        if (status && status !== agent.status) {
            if (status === 'inactive' || status === 'terminated') {
                updateData.status_changed_at = new Date();
                updateData.status_changed_by = request.user?.userId || 'system';
                updateData.previous_status = agent.status;
            }
        }

        // Update the agent
        const updatedAgent = await payservedb.Agent.findByIdAndUpdate(
            agent._id,
            updateData,
            { new: true, runValidators: true }
        )
        .select('-password');

        // Also update the associated User record
        if (agent.user_id) {
            const userUpdateData = {};
            if (firstName || lastName) {
                userUpdateData.fullName = `${firstName} ${lastName}`;
            }
            if (email) userUpdateData.email = email;
            if (phoneNumber) userUpdateData.phoneNumber = phoneNumber;
            if (idNumber) userUpdateData.idNumber = idNumber;

            await payservedb.User.findByIdAndUpdate(
                agent.user_id,
                userUpdateData,
                { runValidators: true }
            );
        }

        logger.info(`Agent updated successfully: ${updatedAgent.agent_id}`);
        return reply.code(200).send({
            message: 'Agent updated successfully',
            agent: updatedAgent
        });

    } catch (err) {
        logger.error(`Error updating agent: ${err.message}`);
        console.log(err);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = update_agent;