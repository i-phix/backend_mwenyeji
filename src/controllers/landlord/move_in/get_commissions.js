const db = require('payservedb');
const logger = require('../../../../config/winston');
const { ensureMoveInLandlordForPayServeUser, sendError } = require('./context');

module.exports = async function get_landlord_move_in_commissions(request, reply) {
    try {
        const { status = 'all', page = 1, limit = 20 } = request.query;
        const { moveInLandlord } = await ensureMoveInLandlordForPayServeUser(request.user.userId);

        const listings = await db.moveIn.MoveInUnit.find({ landlordId: moveInLandlord._id })
            .select('_id sourceFacilityId sourceUnitId')
            .lean();
        const listingIds = listings.map((listing) => listing._id);

        const deals = await db.moveIn.MoveInDeal.find({
            $or: [
                { landlordId: moveInLandlord._id },
                { unitId: { $in: listingIds } },
            ],
        }).select('_id').lean();
        const dealIds = deals.map((deal) => deal._id);

        const filter = {
            $or: [
                { landlordId: moveInLandlord._id },
                { dealId: { $in: dealIds } },
            ],
        };
        if (status !== 'all') filter.status = status;

        const numericLimit = Number(limit);
        const skip = (Number(page) - 1) * numericLimit;
        const [total, commissions] = await Promise.all([
            db.moveIn.MoveInCommission.countDocuments(filter),
            db.moveIn.MoveInCommission.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(numericLimit).lean(),
        ]);

        return reply.code(200).send({
            success: true,
            data: commissions,
            pagination: { total, page: Number(page), limit: numericLimit, pages: Math.ceil(total / numericLimit) },
        });
    } catch (err) {
        logger.error('[landlord/move_in/get_commissions] ' + err.message);
        return sendError(reply, err);
    }
};
