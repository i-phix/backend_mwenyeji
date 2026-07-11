const payservedb = require('payservedb');

const get_family_members = async (request, reply) => {
    try {
        const { customerId } = request.params;

        // Find the customer by ID
        const customer = await payservedb.Customer.findById(customerId);
        if (!customer) {
            return reply.code(404).send({ error: 'Customer not found.' });
        }

        // Return the family members array
        return reply.code(200).send({ familyMembers: customer.familyMembers });

    } catch (err) {
        console.error('Error retrieving family members:', err.message); // Log error for debugging
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_family_members;
