const payservedb = require('payservedb');

const delete_staff_member = async (request, reply) => {
    try {
        const { customerId, staffId } = request.params; // Extract customerId and staffId from params

        // Find the customer by ID
        const customer = await payservedb.Customer.findById(customerId);
        console.log("customer", customer)
        
        if (!customer) {
            return reply.code(404).send({ error: 'Customer not found.' });
        }

        // Find the staff member to delete by ID in the staff array
        const staffIndex = customer.staff.findIndex(
            member => member._id.toString() === staffId
        );

        if (staffIndex === -1) {
            return reply.code(404).send({ error: 'Staff member not found.' });
        }

        // Remove the staff member from the array
        customer.staff.splice(staffIndex, 1);

        // Save the updated customer document
        await customer.save();

        return reply.code(200).send({ message: 'Staff member deleted successfully.' });
    } catch (err) {
        console.error('Error deleting staff member:', err.message); // Log error for debugging
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = delete_staff_member;
