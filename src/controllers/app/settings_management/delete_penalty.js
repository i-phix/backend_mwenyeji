const payservedb = require('payservedb');

const deletePenalty = async (request, reply) => {
    try {
        const { penaltyId } = request.params;

        // Fetch the entry first to check its status
        const penalty = await payservedb.Penalty.findById(penaltyId);

        // Only allow deletion if the record is disabled
        if (!penalty.disabled) {
            return reply.code(403).send({ error: 'You can only delete a disabled record' });
        }

        await payservedb.Penalty.findByIdAndDelete(penaltyId);

        return reply.code(200).send('Penalty deleted successfully');
    } catch (err) {
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = deletePenalty

