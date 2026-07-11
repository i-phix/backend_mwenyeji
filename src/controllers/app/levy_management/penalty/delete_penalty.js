const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const delete_penalty = async (request, reply) => {
    try {
        console.log("delete_penalty");
        const { facilityId, penaltyId } = request.params;

        const penaltyModel = await getModel('Penalty', payservedb.Penalty.schema, facilityId);

        const deletedPenalty = await penaltyModel.findByIdAndDelete(penaltyId);

        if (!deletedPenalty) {
            return reply.code(404).send({ error: 'Penalty not found.' });
        }

        return reply.code(200).send({ message: 'Penalty deleted successfully.' });
    } catch (err) {
        console.error('Error deleting penalty:', err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = delete_penalty;
