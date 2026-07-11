const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const update_penalty = async (request, reply) => {
    try {
        const { penaltyId } = request.params;
        const updates = request.body;

        const penaltyModel = await getModel('Penalty', payservedb.Penalty.schema, updates.facilityId);

        const updatedPenalty = await penaltyModel.findByIdAndUpdate(penaltyId, updates, { new: true });

        if (!updatedPenalty) {
            return reply.code(404).send({ error: 'Penalty not found.' });
        }

        return reply.code(200).send(updatedPenalty);
    } catch (err) {
        console.error('Error updating penalty:', err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = update_penalty;
