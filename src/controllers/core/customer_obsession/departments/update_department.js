const db = require('payservedb');
const logger = require('../../../../../config/winston');

const updateDepartment = async (request, reply) => {
    try {
        const { department_id } = request.params;
        const { name, code, description, active } = request.body;
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

        // Check if code is being changed and if it conflicts
        if (code && code.toUpperCase().trim() !== existingDept.code) {
            const codeExists = await db.AgentDepartment.findOne({
                code: code.toUpperCase().trim(),
                _id: { $ne: department_id }
            });

            if (codeExists) {
                return reply.code(409).send({
                    success: false,
                    error: 'A department with this code already exists'
                });
            }
        }

        // Prepare update data
        const updateData = {
            updated_by: userId,
            updated_at: new Date()
        };

        if (name !== undefined) updateData.name = name.trim();
        if (code !== undefined) updateData.code = code.toUpperCase().trim();
        if (description !== undefined) updateData.description = description.trim();
        if (active !== undefined) updateData.active = active;

        // Update department
        const updatedDepartment = await db.AgentDepartment.findByIdAndUpdate(
            department_id,
            updateData,
            { new: true, runValidators: true }
        );

        logger.info(`Department updated: ${department_id} by user ${userId}`);

        return reply.code(200).send({
            success: true,
            message: 'Department updated successfully',
            data: updatedDepartment
        });

    } catch (error) {
        logger.error(`Error updating department: ${error.message}`, { stack: error.stack });
        return reply.code(500).send({
            success: false,
            error: 'Failed to update department'
        });
    }
};

module.exports = updateDepartment;
