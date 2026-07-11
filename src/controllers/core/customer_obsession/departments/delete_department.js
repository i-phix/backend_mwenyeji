const db = require('payservedb');
const logger = require('../../../../../config/winston');

const deleteDepartment = async (request, reply) => {
    try {
        const { department_id } = request.params;
        const userId = request.user.userId;

        // Validate department_id
        if (!department_id) {
            return reply.code(400).send({
                success: false,
                error: 'Department ID is required'
            });
        }

        // Find existing department
        const existingDept = await db.AgentDepartment.findById(department_id);
        if (!existingDept) {
            return reply.code(404).send({
                success: false,
                error: 'Department not found'
            });
        }

        // Check if department is already archived
        if (existingDept.active === false) {
            return reply.code(400).send({
                success: false,
                error: 'Department is already archived'
            });
        }

        // Check if department is being used by active agents
        const agentsUsingDept = await db.Agent.countDocuments({
            department: existingDept.code,
            status: { $nin: ['inactive', 'terminated'] }
        });

        if (agentsUsingDept > 0) {
            return reply.code(400).send({
                success: false,
                error: `Cannot archive department. It is being used by ${agentsUsingDept} active agent(s).`
            });
        }

        // Archive the department (soft delete)
        const archivedDept = await db.AgentDepartment.findByIdAndUpdate(
            department_id,
            {
                active: false,
                archived_at: new Date(),
                archived_by: userId,
                updated_at: new Date()
            },
            { new: true }
        );

        logger.info(`Department archived: ${department_id} (${existingDept.code}) by user ${userId}`);

        return reply.code(200).send({
            success: true,
            message: 'Department archived successfully',
            data: {
                department: archivedDept,
                archived: true
            }
        });

    } catch (error) {
        logger.error(`Error archiving department: ${error.message}`, { stack: error.stack });
        return reply.code(500).send({
            success: false,
            error: 'Failed to archive department'
        });
    }
};

module.exports = deleteDepartment;
