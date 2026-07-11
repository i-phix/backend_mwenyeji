const db = require('payservedb');
const logger = require('../../../../../config/winston');

const updateRole = async (request, reply) => {
    try {
        const { role_id } = request.params;
        const { name, code, description, level, permissions, active, department } = request.body;
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

        // Check if code is being changed and if it conflicts
        if (code && code.toLowerCase().trim() !== existingRole.code) {
            const codeExists = await db.AgentRole.findOne({
                code: code.toLowerCase().trim(),
                _id: { $ne: role_id }
            });

            if (codeExists) {
                return reply.code(409).send({
                    success: false,
                    error: 'A role with this code already exists'
                });
            }
        }

        // Validate department if provided
        if (department !== undefined && department !== null && department !== '') {
            const existingDepartment = await db.AgentDepartment.findById(department);
            if (!existingDepartment) {
                return reply.code(404).send({
                    success: false,
                    error: 'Department not found'
                });
            }
        }

        // Prepare update data
        const updateData = {
            updated_by: userId,
            updated_at: new Date()
        };

        if (name !== undefined) updateData.name = name.trim();
        if (code !== undefined) updateData.code = code.toLowerCase().trim();
        if (description !== undefined) updateData.description = description.trim();
        if (level !== undefined) updateData.level = level;
        if (permissions !== undefined) updateData.permissions = permissions;
        if (active !== undefined) updateData.active = active;
        if (department !== undefined) updateData.department = department || null;

        // Update role
        const updatedRole = await db.AgentRole.findByIdAndUpdate(
            role_id,
            updateData,
            { new: true, runValidators: true }
        );

        logger.info(`Role updated: ${role_id} by user ${userId}`);

        return reply.code(200).send({
            success: true,
            message: 'Role updated successfully',
            data: updatedRole
        });

    } catch (error) {
        logger.error(`Error updating role: ${error.message}`, { stack: error.stack });
        return reply.code(500).send({
            success: false,
            error: 'Failed to update role'
        });
    }
};

module.exports = updateRole;
