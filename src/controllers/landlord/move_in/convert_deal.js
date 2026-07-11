const db = require('payservedb');
const { ensureMoveInLandlordForPayServeUser, sendError } = require('./context');
const { convertDealToPayServeRental } = require('../../move_in/utils/payserve_conversion');

module.exports = async function convert_landlord_move_in_deal(request, reply) {
    try {
        const { moveInLandlord } = await ensureMoveInLandlordForPayServeUser(request.user.userId);
        const deal = await db.moveIn.MoveInDeal.findById(request.params.dealId).lean();
        if (!deal) return reply.code(404).send({ error: 'Move-In deal not found.' });

        const listing = await db.moveIn.MoveInUnit.findOne({
            $or: [
                { _id: deal.unitId },
                { source: 'payserve', sourceFacilityId: deal.sourceFacilityId, sourceUnitId: deal.sourceUnitId },
            ],
            landlordId: moveInLandlord._id,
        }).lean();

        if (!listing && String(deal.landlordId || '') !== String(moveInLandlord._id)) {
            return reply.code(403).send({ error: 'Access denied.' });
        }

        const result = await convertDealToPayServeRental({
            dealId: deal._id,
            actorId: request.user.userId,
            body: request.body || {},
        });

        return reply.code(200).send({
            success: true,
            message: result.lease
                ? 'Tenant converted to a PayServe rental.'
                : 'Tenant marked as rented. Lease draft is pending required PayServe lease details.',
            data: result,
        });
    } catch (err) {
        return sendError(reply, err);
    }
};
