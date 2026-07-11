const payservedb = require('payservedb');

const updateResident = async (request, reply) => {
    try {
        const { residentId } = request.params;
        const updateData = request.body;

        // Validate that the residentId and updateData are provided
        if (!residentId || !updateData) {
            return reply.code(400).send({ error: 'Resident ID and update data are required' });
        }

        const updatedResident = await payservedb.Resident.findOneAndUpdate(
            { residentId },
            updateData,
            { new: true }
        );

        if (!updatedResident) {
            return reply.code(404).send({ error: 'Resident not found' });
        }

        return reply.code(200).send({ message: 'Resident updated successfully', resident: updatedResident });
    } catch (err) {
        console.error('Error updating resident:', err); // Log error details for troubleshooting
        return reply.code(500).send({ error: 'Internal Server Error', details: err.message });
    }
};

module.exports = updateResident;
