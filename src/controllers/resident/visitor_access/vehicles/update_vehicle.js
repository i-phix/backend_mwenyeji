const payservedb = require('payservedb');

const edit_vehicle = async (request, reply) => {
    try {
        const { customerId, vehicleId } = request.params;
        const { name, model, plateNumber, color } = request.body;

        // Validate input
        if (!name && !model && !plateNumber) {
            return reply.code(400).send({ error: 'At least one field is required to update.' });
        }

        const customer = await payservedb.Customer.findById(customerId);
        if (!customer) {
            return reply.code(404).send({ error: 'Customer not found.' });
        }

        // Find the vehicle to update
        const vehicleIndex = customer.vehicles.findIndex((vehicle) => vehicle._id.toString() === vehicleId);
        if (vehicleIndex === -1) {
            return reply.code(404).send({ error: 'Vehicle not found.' });
        }

        // Update the specific fields of the vehicle
        const vehicle = customer.vehicles[vehicleIndex];
        if (name) vehicle.name = name;
        if (model) vehicle.model = model;
        if (color) vehicle.color = color;
        if (plateNumber) vehicle.plateNumber = plateNumber;

        // Save the updated customer document
        await customer.save();

        return reply.code(200).send('Vehicle updated successfully.');
    } catch (err) {
        // Log error for debugging
        console.error('Error updating vehicle:', err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = edit_vehicle;
