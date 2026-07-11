const logger = require('../../../../config/winston');
const { convertDealToPayServeRental } = require('../utils/payserve_conversion');

const convert_deal = async (request, reply) => {
    try {
        const result = await convertDealToPayServeRental({
            dealId: request.params.dealId,
            actorId: request.user?.userId || null,
            body: request.body || {},
        });

        return reply.code(200).send({
            success: true,
            message: result.lease
                ? 'Move-In deal converted into a PayServe rental.'
                : 'Move-In deal converted. Lease draft is pending required PayServe lease details.',
            data: result,
        });
    } catch (err) {
        logger.error('[move_in/admin/convert_deal] ' + err.message);
        return reply.code(err.statusCode || 502).send({ error: err.message });
    }
};

module.exports = convert_deal;
