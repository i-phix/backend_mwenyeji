const db = require('payservedb');
const logger = require('../../../../config/winston');

// GET /api/move_in/admin/reservations
// Query: status ('pending'|'confirmed'|'cancelled'|'expired'|'all'), page, limit
const get_reservations = async (request, reply) => {
    try {
        const { status = 'pending', page = 1, limit = 20 } = request.query;

        const filter = status !== 'all' ? { status } : {};
        const total = await db.moveIn.MoveInReservation.countDocuments(filter);
        const skip  = (Number(page) - 1) * Number(limit);

        const reservations = await db.moveIn.MoveInReservation.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean();

        return reply.code(200).send({
            success: true,
            data: reservations,
            pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
        });
    } catch (err) {
        logger.error('[move_in/admin/get_reservations] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_reservations;
