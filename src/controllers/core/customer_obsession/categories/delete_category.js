const db = require('payservedb');
const logger = require('../../../../../config/winston');

const deleteCategory = async (request, reply) => {
    try {
        const { category_id } = request.params;

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

        // Check if category is already archived
        if (existingCategory.active === false) {
            return reply.code(400).send({
                success: false,
                error: 'Category is already archived'
            });
        }

        // Check if category is being used in active tickets
        const activeTicketsUsingCategory = await db.CustomerTicket.countDocuments({
            category_id: category_id,
            status: { $nin: ['closed', 'resolved', 'archived'] }
        });

        if (activeTicketsUsingCategory > 0) {
            return reply.code(400).send({
                success: false,
                error: `Cannot archive category. It is being used by ${activeTicketsUsingCategory} active ticket(s). Please close or resolve those tickets first.`
            });
        }

        // Archive the category (soft delete)
        const archivedCategory = await db.TicketCategory.findByIdAndUpdate(
            category_id,
            {
                active: false,
                archived_at: new Date(),
                archived_by: request.user.userId,
                updated_at: new Date()
            },
            { new: true }
        );

        logger.info(`Ticket category archived: ${category_id} (${existingCategory.name}) by user ${request.user.userId}`);

        return reply.code(200).send({
            success: true,
            message: 'Ticket category archived successfully',
            data: {
                category: archivedCategory,
                archived: true
            }
        });

    } catch (error) {
        logger.error(`Error archiving ticket category: ${error.message}`, { stack: error.stack });
        return reply.code(500).send({
            success: false,
            error: 'Failed to archive ticket category'
        });
    }
};

module.exports = deleteCategory;
