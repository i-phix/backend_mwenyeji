const payservedb = require('payservedb');

const add_vehicle = async (request, reply) => {
    try {
        const { customerId } = request.params;
        const { name, model, plateNumber,visitorQRCode } = request.body; // Extract data from the request body

        // Validate input
        if (!name || !model || !plateNumber) {
            return reply.code(400).send({ error: 'All fields are required.' });
        }

        const customer = await payservedb.Customer.findById(customerId);
        if (!customer) {
            return reply.code(404).send({ error: 'Customer not found.' });
        }
        const generateRandomNumber = () => {
            return Math.floor(Math.random() * (1000000 - 10000)) + 10000;
          };

        const newVehicle = {
            no:generateRandomNumber(),
            name,
            model,
            plateNumber,
            qrCode:visitorQRCode,
            disabled:false
        };

        customer.vehicles.push(newVehicle);

        // Save the updated customer document
        await customer.save();

        return reply.code(200).send({ message: 'Vehicle added to customer successfully.' });

    } catch (err) {
        console.error('Error adding vehicle to customer:', err.message); // Log error for debugging
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = add_vehicle

