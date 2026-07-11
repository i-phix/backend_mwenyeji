const db = require('payservedb');
const logger = require('../../../../../config/winston');
const { filterSortPaginate } = require('../../utils/workflow_context');

// GET /api/move_in/landlord/reservations
const get_reservations = async (request, reply) => {
    try {
        const { userId } = request.user;
        const result = await filterSortPaginate({
            model: db.moveIn.MoveInReservation,
            relatedType: 'reservation',
            baseFilter: { landlordId: userId },
            query: request.query,
            defaultLimit: 50,
        });

        return reply.code(200).send({ success: true, data: result.data, pagination: result.pagination });
    } catch (err) {
        logger.error('[move_in/landlord/get_reservations] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_reservations;
