const db = require('payservedb');
const logger = require('../../../../config/winston');

// GET /api/move_in/admin/landlords
// Query params: status ('enabled'|'disabled'|'all'), page, limit
const get_landlords = async (request, reply) => {
    try {
        const { status = 'all', page = 1, limit = 20 } = request.query;

        const filter = {};
        if (status === 'enabled')  filter.isEnabled = true;
        if (status === 'disabled') filter.isEnabled = false;

        const total = await db.moveIn.MoveInLandlordUser.countDocuments(filter);
        const skip  = (Number(page) - 1) * Number(limit);

        const landlords = await db.moveIn.MoveInLandlordUser.find(filter)
            .select('fullName email phoneNumber companyName isEnabled payserveUserId createdAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean();

        // Enrich with unit counts
        const enriched = await Promise.all(landlords.map(async (l) => {
            const unitCount = await db.moveIn.MoveInUnit.countDocuments({ landlordId: l._id });
            return { ...l, unitCount };
        }));

        return reply.code(200).send({
            success: true,
            data: enriched,
            pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
        });
    } catch (err) {
        logger.error('[move_in/admin/get_landlords] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_landlords;
