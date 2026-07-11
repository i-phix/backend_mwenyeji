const payservedb = require('payservedb');

const getResident = async (request, reply) => {
    try {
        const { residentId } = request.params;

        // Validate the residentId format (optional, depending on your setup)
        if (!residentId) {
            return reply.code(400).send({ error: 'Resident ID is required' });
        }

        // Find the resident and populate related data (unit, contracts, levies, invoices)
        const resident = await payservedb.Resident.findOne({ residentId })
            .populate('unitId', 'unitName')
            .populate('contracts')
            .populate('levies')
            .populate('invoices');

        // Check if the resident is found
        if (!resident) {
            return reply.code(404).send({ error: 'Resident not found' });
        }

        // Return the found resident data
        return reply.code(200).send(resident);
    } catch (err) {
        console.error('Error retrieving resident:', err); // Log the error
        return reply.code(502).send({ error: 'Internal Server Error', details: err.message });
    }
};

module.exports = getResident;
