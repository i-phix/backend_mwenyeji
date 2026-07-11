const payservedb = require('payservedb');

const add_vehicle = async (request, reply) => {
    try {
        const { customerId } = request.params;
        const { name, model, color, plateNumber, visitorQRCode, uniqueCode, unit } = request.body; // Extract data from the request body

        // Validate input
        if (!name || !model || !plateNumber) {
            return reply.code(400).send({ error: 'All fields are required.' });
        }

        const customer = await payservedb.Customer.findById(customerId);

        const generateRandomNumber = () => {
            return Math.floor(Math.random() * (1000000 - 10000)) + 10000;
        };
        // Create a new family member entry
        const newVehicle = {
            no: generateRandomNumber(),
            name,
            model,
            color: color,
            plateNumber,
            qrCode: visitorQRCode,
            qrUniqueCode: uniqueCode,
            unit,
            disabled: false,
        };

        // Add family member to the customer's familyMembers array
        customer.vehicles.push(newVehicle);

        // Save the updated customer document
        await customer.save();

        return reply.code(200).send('Vehicle added successfully.');

    } catch (err) {
        // Log error for debugging
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = add_vehicle

