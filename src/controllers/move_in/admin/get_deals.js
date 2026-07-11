const db = require('payservedb');
const logger = require('../../../../config/winston');

// GET /api/move_in/admin/deals?status=all&page=1&limit=20
const get_deals = async (request, reply) => {
    try {
        const { status = 'all', page = 1, limit = 20 } = request.query;
        const filter = status !== 'all' ? { status } : {};
        const skip = (Number(page) - 1) * Number(limit);

        const [total, deals] = await Promise.all([
            db.moveIn.MoveInDeal.countDocuments(filter),
            db.moveIn.MoveInDeal.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(Number(limit)).lean(),
        ]);

        return reply.code(200).send({
            success: true,
            data: deals,
            pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
        });
    } catch (err) {
        logger.error('[move_in/admin/get_deals] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_deals;
