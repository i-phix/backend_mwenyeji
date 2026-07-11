const payservedb = require('payservedb');

const getResidentsByFacility = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        // Validate the facilityId format (optional, depending on your setup)
        if (!facilityId) {
            return reply.code(400).send({ error: 'Facility ID is required' });
        }

        const residents = await payservedb.Resident.find({ facilityId })
            .populate('unitId', 'unitName') // Populate unitName from unitId reference
            .populate('contracts', 'contractName'); // Populate contractName from contracts reference

        // If no residents are found, return an empty array
        if (residents.length === 0) {
            return reply.code(404).send({ message: 'No residents found for this facility' });
        }

        return reply.code(200).send(residents);
    } catch (err) {
        console.error('Error retrieving residents by facility:', err); // Log error for debugging
        return reply.code(502).send({ error: 'Internal Server Error', details: err.message });
    }
};

module.exports = getResidentsByFacility;
