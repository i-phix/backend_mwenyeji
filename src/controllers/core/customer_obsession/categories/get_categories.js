const db = require('payservedb');
const logger = require('../../../../../config/winston');

const getCategories = async (request, reply) => {
    try {
        const { is_active } = request.query;

        const filter = {};
        if (is_active !== undefined) {
            filter.is_active = is_active === 'true';
        }

        const categories = await db.TicketCategory.find(filter)
            .populate('created_by', 'fullName email')
            .populate('updated_by', 'fullName email')
            .sort({ created_at: -1 })
            .lean();

        logger.info(`Ticket categories retrieved: ${categories.length} items`);

        return reply.code(200).send({
            success: true,
            data: categories
        });

    } catch (error) {
        logger.error(`Error retrieving ticket categories: ${error.message}`, { stack: error.stack });
        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve ticket categories'
        });
    }
};

module.exports = getCategories;
