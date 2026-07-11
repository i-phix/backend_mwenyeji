const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const deleteFacilityGuard = async (request, reply) => {
    try {
        const { facilityId, guardId } = request.params;

        const guardModel = await getModel('Guard', payservedb.Guard.schema, facilityId);

        await guardModel.findByIdAndDelete(guardId);

        return reply.code(200).send({success: true, message: 'Guard deleted successfully'});
    } catch (err) {
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = deleteFacilityGuard

