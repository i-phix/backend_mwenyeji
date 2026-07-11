const payservedb = require('payservedb');

const add_staff_member = async (request, reply) => {
    try {
        const { customerId } = request.params;
        const { name, jobRole, phoneNumber,visitorQRCode, uniqueCode, unit } = request.body; // Extract data from the request body

        // Validate input
        if (!name || !jobRole || !phoneNumber) {
            return reply.code(400).send({ error: 'All fields are required.' });
        }

        const customer = await payservedb.Customer.findById(customerId);
        if (!customer) {
            return reply.code(404).send({ error: 'Customer not found.' });
        }

        const generateRandomNumber = () => {
            return Math.floor(Math.random() * (1000000 - 10000)) + 10000;
        };

        const filteredPhoneNumber = phoneNumber.slice(-9);
        const newStaff = {
            no:generateRandomNumber(),
            name,
            jobRole,
            phoneNumber:filteredPhoneNumber,
            qrCode:visitorQRCode,
            qrUniqueCode:uniqueCode,
            unit,
            disabled: false,
        };

        customer.staff.push(newStaff);

        // Save the updated customer document
        await customer.save();

        return reply.code(200).send({ message: 'Staff member added to customer successfully.' });

    } catch (err) {
        console.error('Error adding staff to customer:', err.message); // Log error for debugging
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = add_staff_member;

