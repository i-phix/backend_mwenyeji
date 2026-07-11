const db = require('payservedb');
const logger = require('../../../../../config/winston');

const createDepartment = async (request, reply) => {
    try {
        const { name, code, description } = request.body;
        const userId = request.user.userId;

        // Validate required fields
        if (!name || !name.trim()) {
            return reply.code(400).send({
                success: false,
                error: 'Department name is required'
            });
        }

        if (!code || !code.trim()) {
            return reply.code(400).send({
                success: false,
                error: 'Department code is required'
            });
        }

        // Check if department with same code already exists
        const existingDept = await db.AgentDepartment.findOne({
            code: code.toUpperCase().trim()
        });

        if (existingDept) {
            return reply.code(409).send({
                success: false,
                error: 'A department with this code already exists'
            });
        }

        // Create new department
        const department = new db.AgentDepartment({
            name: name.trim(),
            code: code.toUpperCase().trim(),
            description: description?.trim() || '',
            created_by: userId,
            updated_by: userId
        });

        const savedDepartment = await department.save();

        logger.info(`Department created: ${savedDepartment.code} by user ${userId}`);

        return reply.code(200).send({
            success: true,
            message: 'Department created successfully',
            data: savedDepartment
        });

    } catch (error) {
        logger.error(`Error creating department: ${error.message}`, { stack: error.stack });
        return reply.code(500).send({
            success: false,
            error: 'Failed to create department'
        });
    }
};

module.exports = createDepartment;
