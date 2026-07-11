const db = require('payservedb');
const logger = require('../../../../../config/winston');

const deleteRole = async (request, reply) => {
    try {
        const { role_id } = request.params;
        const userId = request.user.userId;

        // Validate role_id
        if (!role_id) {
            return reply.code(400).send({
                success: false,
                error: 'Role ID is required'
            });
        }

        // Find existing role
        const existingRole = await db.AgentRole.findById(role_id);
        if (!existingRole) {
            return reply.code(404).send({
                success: false,
                error: 'Role not found'
            });
        }

        // Check if role is already archived
        if (existingRole.active === false) {
            return reply.code(400).send({
                success: false,
                error: 'Role is already archived'
            });
        }

        // Check if role is being used by active agents
        const agentsUsingRole = await db.Agent.countDocuments({
            role: existingRole.code,
            status: { $nin: ['inactive', 'terminated'] }
        });

        if (agentsUsingRole > 0) {
            return reply.code(400).send({
                success: false,
                error: `Cannot archive role. It is being used by ${agentsUsingRole} active agent(s).`
            });
        }

        // Archive the role (soft delete)
        const archivedRole = await db.AgentRole.findByIdAndUpdate(
            role_id,
            {
                active: false,
                archived_at: new Date(),
                archived_by: userId,
                updated_at: new Date()
            },
            { new: true }
        );

        logger.info(`Role archived: ${role_id} (${existingRole.code}) by user ${userId}`);

        return reply.code(200).send({
            success: true,
            message: 'Role archived successfully',
            data: {
                role: archivedRole,
                archived: true
            }
        });

    } catch (error) {
        logger.error(`Error archiving role: ${error.message}`, { stack: error.stack });
        return reply.code(500).send({
            success: false,
            error: 'Failed to archive role'
        });
    }
};

module.exports = deleteRole;
