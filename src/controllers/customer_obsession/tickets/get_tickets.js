const payservedb = require('payservedb');
const logger = require('../../../../config/winston');

async function get_tickets(request, reply) {
    try {
        // Extract query parameters for filtering
        const {
            status,
            priority,
            category,
            assigned_to,
            customer_id,
            facility_id,
            date_from,
            date_to,
            search,
            page = 1,
            limit = 20,
            sort_by = 'created_at',
            sort_order = 'desc'
        } = request.query;

        // Build filter query
        let filter = {};
        // All agents can see all tickets by default.

        // Apply additional filters
        if (status) filter.status = status;
        if (priority) {
            // Find categories with this priority
            const categories = await payservedb.TicketCategory.find({ priority });
            const categoryIds = categories.map(c => c._id);
            filter.category_id = { $in: categoryIds };
        }
        if (category) filter.category_id = category;
        if (assigned_to) filter.assigned_agent_id = assigned_to;
        if (customer_id) filter.customer_id = customer_id;
        if (facility_id) filter.facility_id = facility_id;

        // Date range filter
        if (date_from || date_to) {
            filter.created_at = {};
            if (date_from) filter.created_at.$gte = new Date(date_from);
            if (date_to) filter.created_at.$lte = new Date(date_to);
        }

        // Search filter
        if (search) {
            const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const searchRegex = new RegExp(escapeRegex(search), 'i');

            const [matchingCustomers, matchingFacilities] = await Promise.all([
                payservedb.Customer.find({
                    $or: [
                        { customerNumber: searchRegex },
                        { fullName: searchRegex },
                        { name: searchRegex },
                        { firstName: searchRegex },
                        { lastName: searchRegex },
                        { email: searchRegex },
                        { phoneNumber: searchRegex },
                        { phone: searchRegex },
                        { unitId: searchRegex }
                    ]
                }).select('_id').lean(),
                payservedb.Facility.find({
                    $or: [
                        { name: searchRegex },
                        { location: searchRegex },
                        { address: searchRegex }
                    ]
                }).select('_id').lean()
            ]);

            const customerIds = matchingCustomers.map((c) => c._id);
            const facilityIds = matchingFacilities.map((f) => f._id);

            filter.$or = [
                { ticket_number: { $regex: search, $options: 'i' } },
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                ...(customerIds.length ? [{ customer_id: { $in: customerIds } }] : []),
                ...(facilityIds.length ? [{ facility_id: { $in: facilityIds } }] : [])
            ];
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortOptions = {};
        sortOptions[sort_by] = sort_order === 'desc' ? -1 : 1;

        // Get tickets with populated data
        const tickets = await payservedb.CustomerTicket.find(filter)
            .populate('customer_id', 'fullName firstName lastName email phoneNumber phone unitId address')
            .populate('assigned_agent_id', 'fullName firstName lastName email phoneNumber')
            .populate('created_by_agent_id', 'fullName firstName lastName email phoneNumber')
            .populate('facility_id', 'name company_id address')
            .populate('category_id', 'name priority color sla_minutes')
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // Get total count for pagination
        const total_count = await payservedb.CustomerTicket.countDocuments(filter);

        // Calculate SLA status for each ticket
        const enrichedTickets = tickets.map(ticket => {
            const now = new Date();
            const sla_due = ticket.sla_due_date ? new Date(ticket.sla_due_date) : null;

            let sla_status = 'on_time';
            let time_remaining = null;

            if (sla_due) {
                time_remaining = sla_due.getTime() - now.getTime();
                if (time_remaining < 0) {
                    sla_status = 'overdue';
                } else if (time_remaining < (2 * 60 * 60 * 1000)) { // Less than 2 hours
                    sla_status = 'at_risk';
                }
            }

            return {
                ...ticket,
                sla_status,
                time_remaining: Math.max(0, time_remaining || 0)
            };
        });

        // Pagination metadata
        const pagination = {
            current_page: parseInt(page),
            per_page: parseInt(limit),
            total_items: total_count,
            total_pages: Math.ceil(total_count / parseInt(limit)),
            has_next_page: parseInt(page) < Math.ceil(total_count / parseInt(limit)),
            has_prev_page: parseInt(page) > 1
        };

        logger.info(`Retrieved ${tickets.length} tickets`);

        return reply.code(200).send({
            success: true,
            data: {
                tickets: enrichedTickets,
                pagination,
                filters_applied: {
                    status,
                    priority,
                    category,
                    assigned_to,
                    search,
                    date_range: { from: date_from, to: date_to }
                }
            }
        });

    } catch (error) {
        logger.error(`Error retrieving tickets: ${error.message}`, { stack: error.stack });
        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve tickets'
        });
    }
}

module.exports = get_tickets;
