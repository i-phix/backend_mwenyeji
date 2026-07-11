const payservedb = require('payservedb');

const deleteResident = async (request, reply) => {
    try {
        const { residentId } = request.params;

        // Check if residentId is valid
        if (!residentId) {
            return reply.code(400).send({ error: 'Resident ID is required' });
        }

        const resident = await payservedb.Resident.findOneAndDelete({ residentId });

        if (!resident) {
            return reply.code(404).send({ error: 'Resident not found' });
        }

        return reply.code(200).send({ message: 'Resident deleted successfully', resident });
    } catch (err) {
        console.error('Error deleting resident:', err); // Log detailed error
        return reply.code(500).send({ error: 'Internal Server Error', details: err.message });
    }
};

module.exports = deleteResident;
