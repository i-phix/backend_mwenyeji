const db = require('payservedb');
const logger = require('../../../../../config/winston');

// GET /api/core/move_in/landlords
// Returns all landlords that have been assigned the Move-In module.
// Enriches with landlord details from payserve_property.
const get_landlords = async (request, reply) => {
    try {
        const { status = 'all' } = request.query;

        const filter = {};
        if (status === 'active') filter.isEnabled = true;
        if (status === 'revoked') filter.isEnabled = false;

        const records = await db.moveIn.MoveInLandlord.find(filter)
            .sort({ assignedAt: -1 })
            .lean();

        const landlordIds = records.map((r) => r.landlordId);

        // Enrich from payserve_property
        const landlords = await db.User.find({ _id: { $in: landlordIds } })
            .select('fullName email phoneNumber type')
            .lean();

        const landlordMap = {};
        for (const l of landlords) landlordMap[l._id.toString()] = l;

        const enriched = records.map((r) => {
            const l = landlordMap[r.landlordId.toString()] || {};
            return {
                _id: r._id,
                landlordId: r.landlordId,
                fullName: l.fullName || '—',
                email: l.email || '—',
                phoneNumber: l.phoneNumber || '—',
                isEnabled: r.isEnabled,
                assignedAt: r.assignedAt,
                revokedAt: r.revokedAt,
            };
        });

        return reply.code(200).send({ success: true, data: enriched, total: enriched.length });
    } catch (err) {
        logger.error('[core/move_in/landlords/get] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_landlords;
