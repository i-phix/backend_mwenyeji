const payservedb = require('payservedb');
const logger = require('../../../../../config/winston');

const update_agent_role = async (request, reply) => {
    try {
        const { id } = request.params;
        const { role, team_id, department, permissions } = request.body;

        if (!id) {
            return reply.code(400).send({
                error: 'Agent ID is required'
            });
        }

        if (!role) {
            return reply.code(400).send({
                error: 'Role is required'
            });
        }

        // Validate role exists in AgentRole collection
        const roleDoc = await payservedb.AgentRole.findOne({ code: role.toLowerCase() });
        if (!roleDoc) {
            return reply.code(400).send({
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

        // Track role change history
        const roleChangeHistory = {
            previous_role: agent.role,
            new_role: role,
            changed_by: request.user?.userId || 'system',
            changed_at: new Date(),
            reason: request.body.reason || 'Role update'
        };

        // Prepare update data
        const updateData = {
            role: roleDoc.code,
            permissions: roleDoc.permissions || [],
            updated_by: request.user?.userId || 'system',
            updatedAt: new Date(),
            $push: {
                role_history: roleChangeHistory
            }
        };

        // Update optional fields if provided
        if (team_id !== undefined) updateData.team_id = team_id;
        if (department !== undefined) updateData.department = department;

        // Update the agent
        const updatedAgent = await payservedb.Agent.findByIdAndUpdate(
            agent._id,
            updateData,
            { new: true, runValidators: true }
        )
        .select('-password')
        .populate('facility_id', 'facilityName facilityType')
        .populate('updated_by', 'firstName lastName');

        logger.info(`Agent role updated successfully: ${updatedAgent.agent_id} - ${agent.role} -> ${role}`);
        return reply.code(200).send({
            message: 'Agent role updated successfully',
            agent: updatedAgent,
            roleChange: roleChangeHistory
        });

    } catch (err) {
        logger.error(`Error updating agent role: ${err.message}`);
        console.log(err);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = update_agent_role;