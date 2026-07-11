const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const get_lease_penalties = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        if (!facilityId) {
            return reply.code(400).send({
                success: false,
                error: 'Facility ID is required'
            });
        }

        const penaltyModel = await getModel('Penalty', payservedb.Penalty.schema, facilityId);

        const query = { 
            facilityId,
            module: 'lease'
        };

        const penalties = await penaltyModel.find(query)
            .select('name type amount percentage effectDays isActive createdAt')
            .sort({ name: 1 })
            .lean()
            .exec();

        // Ensure we're returning an array
        const data = Array.isArray(penalties) ? penalties : [];

        return reply.code(200).send({
            success: true,
            data: data,
            count: data.length
        });

    } catch (error) {
        console.error('Error in get_lease_penalties:', error);
        return reply.code(500).send({
            success: false,
            error: 'Failed to fetch lease penalties',
            details: error.message
        });
    }
};

module.exports = get_lease_penalties;