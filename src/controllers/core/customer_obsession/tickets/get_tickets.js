const payservedb = require('payservedb');
const logger = require('../../../../../config/winston');

const getTickets = async (request, reply) => {
    try {
        const { status, priority, search, page = 1, limit = 50 } = request.query;

        // Build filter
        const filter = {};

        if (status) {
            filter.status = status;
        }

        if (priority) {
            // Priority comes from category, we'll filter after population
        }

        if (search) {
            filter.$or = [
                { ticket_number: { $regex: search, $options: 'i' } },
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get tickets with populated references
        const tickets = await payservedb.CustomerTicket.find(filter)
            .populate('customer_id', 'firstName lastName fullName email phoneNumber phone')
            .populate('assigned_agent_id', 'firstName lastName fullName email agentId agent_id')
            .populate('created_by_agent_id', 'firstName lastName fullName email agentId agent_id')
            .populate('category_id', 'name priority color')
            .populate('facility_id', 'name')
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // Filter by priority if specified (after population)
        let filteredTickets = tickets;
        if (priority) {
            filteredTickets = tickets.filter(ticket =>
                ticket.category_id?.priority?.toLowerCase() === priority.toLowerCase()
            );
        }

        // Get total count
        const totalTickets = await payservedb.CustomerTicket.countDocuments(filter);

        logger.info(`Retrieved ${filteredTickets.length} tickets`);

        return reply.code(200).send({
            success: true,
            data: filteredTickets,
            pagination: {
                current_page: parseInt(page),
                per_page: parseInt(limit),
                total_items: totalTickets,
                total_pages: Math.ceil(totalTickets / parseInt(limit))
            }
        });

    } catch (err) {
        logger.error(`Error retrieving tickets: ${err.message}`, { stack: err.stack });
        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve tickets'
        });
    }
};

module.exports = getTickets;
