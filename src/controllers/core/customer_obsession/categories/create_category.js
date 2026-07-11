const db = require('payservedb');
const logger = require('../../../../../config/winston');

const createCategory = async (request, reply) => {
    try {
        console.log('Create category request body:', request.body);
        console.log('Request user:', request.user);

        const {
            name,
            description,
            priority,
            sla_minutes,
            color,
            is_active
        } = request.body;

        // Validation
        if (!name || !name.trim()) {
            return reply.code(400).send({
                success: false,
                error: 'Category name is required'
            });
        }

        if (!priority) {
            return reply.code(400).send({
                success: false,
                error: 'Priority is required'
            });
        }

        if (!sla_minutes || sla_minutes <= 0) {
            return reply.code(400).send({
                success: false,
                error: 'SLA minutes must be greater than 0'
            });
        }

        // Check if category name already exists
        const existingCategory = await db.TicketCategory.findOne({
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
        });

        if (existingCategory) {
            return reply.code(400).send({
                success: false,
                error: 'Category name already exists'
            });
        }

        // Get user ID - handle different possible structures
        const userId = request.user?.userId || request.user?.id || request.user?._id;

        if (!userId) {
            console.error('No user ID found in request.user:', request.user);
            return reply.code(401).send({
                success: false,
                error: 'User authentication required'
            });
        }

        // Create category
        const category = new db.TicketCategory({
            name: name.trim(),
            description: description?.trim() || '',
            priority,
            sla_minutes: parseInt(sla_minutes),
            color: color || '#3b82f6',
            is_active: is_active !== undefined ? is_active : true,
            created_by: userId,
            updated_by: userId
        });

        const savedCategory = await category.save();

        logger.info(`Ticket category created: ${savedCategory._id} by user ${userId}`);

        return reply.code(200).send({
            success: true,
            message: 'Ticket category created successfully',
            data: savedCategory
        });

    } catch (error) {
        console.error('Detailed error creating ticket category:', error);
        logger.error(`Error creating ticket category: ${error.message}`, { stack: error.stack });

        // Return more detailed error for debugging
        return reply.code(500).send({
            success: false,
            error: 'Failed to create ticket category',
            details: error.message,
            validationErrors: error.errors ? Object.keys(error.errors).map(key => ({
                field: key,
                message: error.errors[key].message
            })) : undefined
        });
    }
};

module.exports = createCategory;
