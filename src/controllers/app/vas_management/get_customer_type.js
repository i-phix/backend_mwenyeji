const payservedb = require('payservedb');
const mongoose = require('mongoose');

const get_customer_type = async (request, reply) => {
    try {
        const { customerId } = request.params;

        // Validate customerId presence
        if (!customerId) {
            return reply.code(400).send({
                success: false,
                error: 'Customer ID is required'
            });
        }

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(customerId)) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid Customer ID format'
            });
        }

        // Fetch customer type
        const customerType = await payservedb.Customer.findById(customerId)
            .select('customerType')
            .lean();

        // Handle case where customer is not found
        if (!customerType) {
            return reply.code(404).send({
                success: false,
                error: 'Customer not found'
            });
        }

        // Transform customer type to uppercase and return
        const upperCaseType = {
            ...customerType,
            customerType: customerType.customerType || null
        };

        // Success response
        return reply.code(200).send({
            success: true,
            data: upperCaseType
        });

    } catch (err) {
        console.error('Error in get_customer_type:', err);
        return reply.code(500).send({
            success: false,
            error: err.message,
            stack: err.stack
        });
    }
};

module.exports = get_customer_type;