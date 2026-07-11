const payservedb = require('payservedb');

const get_staff = async (request, reply) => {
    try {
        const { customerId } = request.params;

        // Find the customer by ID
        const customer = await payservedb.Customer.findById(customerId);
        if (!customer) {
            return reply.code(404).send({ error: 'Customer not found.' });
        }

        return reply.code(200).send({ staff: customer.staff });

    } catch (err) {
        console.error('Error retrieving staff members:', err.message); // Log error for debugging
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_staff;
