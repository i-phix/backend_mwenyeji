const db = require('payservedb');
const logger = require('../../../../../config/winston');

const createRole = async (request, reply) => {
    try {
        const { name, code, description, level, permissions, department } = request.body;
        const userId = request.user.userId;

        // Validate required fields
        if (!name || !name.trim()) {
            return reply.code(400).send({
                success: false,
                error: 'Role name is required'
            });
        }

        if (!code || !code.trim()) {
            return reply.code(400).send({
                success: false,
                error: 'Role code is required'
            });
        }

        // Check if role with same code already exists
        const existingRole = await db.AgentRole.findOne({
            code: code.toLowerCase().trim()
        });

        if (existingRole) {
            return reply.code(409).send({
                success: false,
                error: 'A role with this code already exists'
            });
        }

        // Validate department if provided
        if (department) {
            const existingDepartment = await db.AgentDepartment.findById(department);
            if (!existingDepartment) {
                return reply.code(404).send({
                    success: false,
                    error: 'Department not found'
                });
            }
        }

        // Create new role
        const role = new db.AgentRole({
            name: name.trim(),
            code: code.toLowerCase().trim(),
            description: description?.trim() || '',
            level: level || 1,
            permissions: permissions || [],
            department: department || null,
            created_by: userId,
            updated_by: userId
        });

        const savedRole = await role.save();

        logger.info(`Role created: ${savedRole.code} by user ${userId}`);

        return reply.code(200).send({
            success: true,
            message: 'Role created successfully',
            data: savedRole
        });

    } catch (error) {
        logger.error(`Error creating role: ${error.message}`, { stack: error.stack });
        return reply.code(500).send({
            success: false,
            error: 'Failed to create role'
        });
    }
};

module.exports = createRole;
