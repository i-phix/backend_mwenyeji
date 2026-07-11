const payservedb = require('payservedb');

const getResidentPaymentHistory = async (request, reply) => {
    try {
        const { residentId } = request.params;

        // Validate the residentId format (optional, depending on your setup)
        if (!residentId) {
            return reply.code(400).send({ error: 'Resident ID is required' });
        }

        const resident = await payservedb.Resident.findOne({ residentId }, 'paymentHistory');

        if (!resident) {
            return reply.code(404).send({ error: 'Resident not found' });
        }

        // Return the paymentHistory, if none exists, it will return an empty array
        return reply.code(200).send(resident.paymentHistory || []);
    } catch (err) {
        console.error('Error retrieving payment history for resident:', err); // Log error for debugging
        return reply.code(502).send({ error: 'Internal Server Error', details: err.message });
    }
};

module.exports = getResidentPaymentHistory;
