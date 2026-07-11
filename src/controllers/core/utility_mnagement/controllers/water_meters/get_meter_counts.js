const payservedb = require('payservedb');
const logger = require('../../../../../../config/winston');

const getMeterCounts = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        // Validate facilityId
        if (!facilityId) {
            return reply.code(400).send({
                error: 'Facility ID is required'
            });
        }

        // Count meters for the given facility by status
        const closedCount = await payservedb.WaterMeter.countDocuments({ facilityId, status: 'closed' });
        const openCount = await payservedb.WaterMeter.countDocuments({ facilityId, status: 'open' });

        return reply.code(200).send({
            closed: closedCount,
            open: openCount
        });
    } catch (err) {
        logger.error(err);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = getMeterCounts;
