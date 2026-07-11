const db = require('payservedb');
const logger = require('../../../../../config/winston');

const updateCategory = async (request, reply) => {
    try {
        const { category_id } = request.params;
        const {
            name,
            description,
            priority,
            sla_minutes,
            color,
            is_active
        } = request.body;

        // Validate category_id
        if (!category_id) {
            return reply.code(400).send({
                success: false,
                error: 'Category ID is required'
            });
        }

        // Find existing category
        const existingCategory = await db.TicketCategory.findById(category_id);
        if (!existingCategory) {
            return reply.code(404).send({
                success: false,
                error: 'Ticket category not found'
            });
        }

        // Check if new name conflicts with another category
        if (name && name.trim() !== existingCategory.name) {
            const duplicateCategory = await db.TicketCategory.findOne({
                _id: { $ne: category_id },
                name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
            });

            if (duplicateCategory) {
                return reply.code(400).send({
                    success: false,
                    error: 'Category name already exists'
                });
            }
        }

        // Prepare update data
        const updateData = {
            updated_by: request.user.userId,
            updated_at: new Date()
        };

        if (name !== undefined) updateData.name = name.trim();
        if (description !== undefined) updateData.description = description.trim();
        if (priority !== undefined) updateData.priority = priority;
        if (sla_minutes !== undefined) updateData.sla_minutes = parseInt(sla_minutes);
        if (color !== undefined) updateData.color = color;
        if (is_active !== undefined) updateData.is_active = is_active;

        // Update category
        const updatedCategory = await db.TicketCategory.findByIdAndUpdate(
            category_id,
            updateData,
            { new: true, runValidators: true }
        )
            .populate('created_by', 'fullName email')
            .populate('updated_by', 'fullName email');

        logger.info(`Ticket category updated: ${category_id} by user ${request.user.userId}`);

        return reply.code(200).send({
            success: true,
            message: 'Ticket category updated successfully',
            data: updatedCategory
        });

    } catch (error) {
        logger.error(`Error updating ticket category: ${error.message}`, { stack: error.stack });
        return reply.code(500).send({
            success: false,
            error: 'Failed to update ticket category'
        });
    }
};

module.exports = updateCategory;
