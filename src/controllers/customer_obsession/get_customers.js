const payservedb = require('payservedb');
const logger = require('../../../config/winston');

async function get_customers(request, reply) {
    try {
        const agent = request.user;
        const { facilityId } = request.params;
        const { search, page = 1, limit = 20 } = request.query;

        // Validate facility exists
        const facility = await payservedb.Facility.findById(facilityId);
        if (!facility) {
            return reply.code(404).send({
                success: false,
                error: 'Facility not found'
            });
        }

        // Build filter query - supporting multitenancy
        let filter = { facilityId: facilityId };

        // Add search filter if provided
        if (search) {
            filter.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phoneNumber: { $regex: search, $options: 'i' } },
                { customerNumber: { $regex: search, $options: 'i' } }
            ];
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get customers with pagination
        const customers = await payservedb.Customer.find(filter)
            .select('customerNumber firstName lastName email phoneNumber unitId _id')
            .sort({ firstName: 1, lastName: 1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // Get total count for pagination
        const total_count = await payservedb.Customer.countDocuments(filter);

        // Format customers for display
        const formattedCustomers = customers.map(customer => ({
            _id: customer._id,
            customerNumber: customer.customerNumber,
            fullName: `${customer.firstName} ${customer.lastName}`,
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email,
            phoneNumber: customer.phoneNumber,
            unitId: customer.unitId
        }));

        // Pagination metadata
        const pagination = {
            current_page: parseInt(page),
            per_page: parseInt(limit),
            total_items: total_count,
            total_pages: Math.ceil(total_count / parseInt(limit)),
            has_next_page: parseInt(page) < Math.ceil(total_count / parseInt(limit)),
            has_prev_page: parseInt(page) > 1
        };

        logger.info(`Agent ${agent.agent?.agent_id} retrieved ${customers.length} customers for facility ${facilityId}`);

        return reply.code(200).send({
            success: true,
            data: {
                customers: formattedCustomers,
                pagination,
                facility: {
                    _id: facility._id,
                    name: facility.name,
                    location: facility.location
                }
            }
        });

    } catch (error) {
        logger.error(`Error retrieving customers: ${error.message}`);
        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve customers'
        });
    }
}

module.exports = get_customers;