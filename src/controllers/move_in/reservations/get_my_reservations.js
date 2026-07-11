const db = require('payservedb');
const logger = require('../../../../config/winston');

// GET /api/move_in/reservations
const get_my_reservations = async (request, reply) => {
    try {
        const { userId } = request.user;
        const { status = 'Active' } = request.query;

        const filter = { tenantId: userId };
        if (status === 'Active') {
            filter.status = { $in: ['pending', 'confirmed'] };
        } else if (status !== 'All') {
            filter.status = status;
        }

        const reservations = await db.moveIn.MoveInReservation.find(filter).sort({ createdAt: -1 }).lean();
        return reply.code(200).send({ success: true, data: reservations });
    } catch (err) {
        logger.error('[move_in/reservations/get] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_my_reservations;
