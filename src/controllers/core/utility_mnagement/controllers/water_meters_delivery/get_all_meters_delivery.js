const payservedb = require('payservedb');
const logger = require('../../../../../../config/winston');

const getDeliveries = async (request, reply) => {
    try {
        // Basic query object
        const query = {};

        // Add filters only if they exist in the request
        if (request.query.facilityId) {
            query.facilityId = request.query.facilityId;
        }
        if (request.query.status) {
            query.status = request.query.status;
        }
        if (request.query.deliveredBy) {
            query.deliveredBy = request.query.deliveredBy;
        }
        if (request.query.startDate && request.query.endDate) {
            query.deliveryDate = {
                $gte: new Date(request.query.startDate),
                $lte: new Date(request.query.endDate)
            };
        }

        // Use the payservedb.MetersDelivery model directly
        const deliveries = await payservedb.MetersDelivery
            .find(query)
            .populate('facilityId', 'name location')
            .sort({ deliveryDate: -1 });

            return reply.code(200).send(deliveries);

    } catch (err) {
        return reply.code(502).send({ 
            error: 'Failed to fetch deliveries',
            details: err.message 
        });
    }
};

module.exports = getDeliveries;