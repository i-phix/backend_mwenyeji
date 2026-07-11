const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const getCronJobs = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        const cronModel = await getModel('PendingCredential', payservedb.PendingCredential.schema, facilityId);

        const cronjobs = await cronModel.find({ facilityId })

        return reply.code(200).send({
            success: true,
            cronjobs
        });
    } catch (err) {
        console.error('Error in getting cronjobs:', err);
        return reply.code(400).send({
            success: false,
            error: err.message
        });
    }
};

module.exports = getCronJobs;