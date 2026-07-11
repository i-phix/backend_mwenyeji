// controllers/lease/penalties/get_lease_penalty.js
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const get_lease_penalty = async (request, reply) => {
    try {
        const { facilityId, penaltyId } = request.params;

        const penaltyModel = await getModel('Penalty', payservedb.Penalty.schema, facilityId);

        const penalty = await penaltyModel.findOne({
            _id: penaltyId,
            facilityId,
            module: 'lease'
        });

        if (!penalty) {
            return reply.code(404).send({
                error: 'Lease penalty not found'
            });
        }

        return reply.code(200).send({
            message: 'Lease penalty retrieved successfully',
            data: penalty
        });

    } catch (error) {
        console.error('Error in get_lease_penalty:', error);
        return reply.code(500).send({
            error: 'Failed to fetch lease penalty',
            details: error.message
        });
    }
};

module.exports = get_lease_penalty;