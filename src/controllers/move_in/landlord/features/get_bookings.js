const db = require('payservedb');
const logger = require('../../../../../config/winston');
const { filterSortPaginate } = require('../../utils/workflow_context');

// GET /api/move_in/landlord/viewings/bookings
const get_bookings = async (request, reply) => {
    try {
        const { userId } = request.user;
        const result = await filterSortPaginate({
            model: db.moveIn.MoveInBooking,
            relatedType: 'viewing',
            baseFilter: { landlordId: userId },
            query: request.query,
            defaultLimit: 50,
        });
        return reply.code(200).send({ success: true, data: result.data, pagination: result.pagination });
    } catch (err) {
        logger.error('[move_in/landlord/get_bookings] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_bookings;
