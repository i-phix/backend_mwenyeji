const db = require('payservedb');
const logger = require('../../../../config/winston');

// GET /api/move_in/viewing/bookings
const get_my_bookings = async (request, reply) => {
    try {
        const { userId } = request.user;
        const { status = 'All' } = request.query;

        const filter = { tenantId: userId };
        if (status !== 'All') filter.status = status;

        const bookings = await db.moveIn.MoveInBooking.find(filter).sort({ scheduledDate: -1 }).lean();
        return reply.code(200).send({ success: true, data: bookings });
    } catch (err) {
        logger.error('[move_in/viewing/get_my_bookings] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_my_bookings;
