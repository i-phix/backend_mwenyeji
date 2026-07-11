const db = require('payservedb');
const logger = require('../../../../config/winston');

// GET /api/move_in/admin/units/pending
// Returns all MoveInUnits with moveInApproval === null or 'pending'
const get_pending_units = async (request, reply) => {
    try {
        const { page = 1, limit = 20 } = request.query;
        const filter = { moveInApproval: { $in: [null, 'pending'] } };

        const total = await db.moveIn.MoveInUnit.countDocuments(filter);
        const skip  = (Number(page) - 1) * Number(limit);

        const units = await db.moveIn.MoveInUnit.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean();

        return reply.code(200).send({
            success: true,
            data: units,
            pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
        });
    } catch (err) {
        logger.error('[move_in/admin/get_pending_units] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_pending_units;
