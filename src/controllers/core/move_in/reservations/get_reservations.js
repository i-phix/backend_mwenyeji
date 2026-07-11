const db = require('payservedb');
const logger = require('../../../../../config/winston');
const { filterSortPaginate } = require('../../../move_in/utils/workflow_context');

// GET /api/core/move_in/reservations
const get_reservations = async (request, reply) => {
    try {
        const result = await filterSortPaginate({
            model: db.moveIn.MoveInReservation,
            relatedType: 'reservation',
            baseFilter: {},
            query: request.query,
            defaultLimit: 30,
        });

        return reply.code(200).send({
            success: true,
            data: result.data,
            pagination: result.pagination,
        });
    } catch (err) {
        logger.error('[core/move_in/reservations] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_reservations;
