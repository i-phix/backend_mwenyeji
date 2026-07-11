const db = require('payservedb');
const logger = require('../../../../config/winston');
const { convertDealToPayServeRental } = require('../../move_in/utils/payserve_conversion');

module.exports = async function convert_app_move_in_deal(request, reply) {
    try {
        const { dealId } = request.params;
        const facilityId = request.params.facilityId || request.body?.facilityId;
        const deal = await db.moveIn.MoveInDeal.findById(dealId).lean();
        if (!deal) return reply.code(404).send({ error: 'Move-In deal not found.' });
        if (facilityId && String(deal.sourceFacilityId || '') !== String(facilityId)) {
            return reply.code(403).send({ error: 'This Move-In deal does not belong to the selected facility.' });
        }

        const result = await convertDealToPayServeRental({
            dealId,
            actorId: request.user?.userId || null,
            body: { ...(request.body || {}), facilityId: facilityId || request.body?.facilityId },
        });

        return reply.code(200).send({
            success: true,
            message: result.lease
                ? 'Move-In tenant converted to a PayServe rental.'
                : 'Move-In tenant converted. Lease draft is pending required lease settings.',
            data: result,
        });
    } catch (err) {
        logger.error('[app/move_in/convert_deal] ' + err.message);
        return reply.code(err.statusCode || 502).send({ error: err.message });
    }
};
