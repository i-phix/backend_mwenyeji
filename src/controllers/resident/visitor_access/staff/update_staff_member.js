const payservedb = require('payservedb');

const edit_staff_member = async (request, reply) => {
    try {
        const { customerId, staffId } = request.params;
        const { name, jobRole, phoneNumber } = request.body;

        // Validate input
        if (!name && !jobRole && !phoneNumber) {
            return reply.code(400).send({ error: 'At least one field is required to update.' });
        }

        const customer = await payservedb.Customer.findById(customerId);
        if (!customer) {
            return reply.code(404).send({ error: 'Customer not found.' });
        }

        // Find the staff member to update
        const staffIndex = customer.staff.findIndex((staff) => staff._id.toString() === staffId);
        if (staffIndex === -1) {
            return reply.code(404).send({ error: 'Staff member not found.' });
        }

        const phoneNumberRegex = /^(07\d{8}|254\d{9}|7\d{8})$/;

        if (!phoneNumberRegex.test(phoneNumber)) {
            return reply.code(400).send({ error: 'Please enter a valid phone number in the format "0712345678", "254712345678", or "712345678".' });
        }

        // If the phone number is valid, filter it to keep the last 9 digits
        const filteredPhoneNumber = phoneNumber.replace(/^(0|254)?/, '');

        // Update the specific fields of the staff member
        const staff = customer.staff[staffIndex];
        if (name) staff.name = name;
        if (jobRole) staff.jobRole = jobRole;
        if (phoneNumber) staff.phoneNumber = filteredPhoneNumber;

        // Save the updated customer document
        await customer.save();

        return reply.code(200).send({ message: 'Staff member updated successfully.' });
    } catch (err) {
        console.error('Error updating staff member:', err.message); // Log error for debugging
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = edit_staff_member;
