const payservedb = require('payservedb');

const delete_vehicle = async (request, reply) => {
    try {
        const { customerId, vehicleId } = request.params; // Extract customerId and familyMemberId from params

        // Find the customer by ID
        const customer = await payservedb.Customer.findById(customerId);
        if (!customer) {
            return reply.code(404).send({ error: 'Customer not found.' });
        }

        // Find the family member to delete by ID in the familyMembers array
        const vehicleIndex = customer.vehicles.findIndex(
            member => member._id.toString() === vehicleId
        );

        if (vehicleIndex === -1) {
            return reply.code(404).send({ error: 'Vehicle not found.' });
        }

        // Remove the family member from the array
        customer.vehicles.splice(vehicleIndex, 1);

        // Save the updated customer document
        await customer.save();

        return reply.code(200).send({ message: 'Vehicle deleted successfully.' });
    } catch (err) {
        // Log error for debugging
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = delete_vehicle;
