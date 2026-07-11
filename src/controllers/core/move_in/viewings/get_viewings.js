const db = require('payservedb');
const logger = require('../../../../../config/winston');
const { filterSortPaginate } = require('../../../move_in/utils/workflow_context');

// GET /api/core/move_in/viewings
const get_viewings = async (request, reply) => {
    try {
        const result = await filterSortPaginate({
            model: db.moveIn.MoveInBooking,
            relatedType: 'viewing',
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
        logger.error('[core/move_in/viewings] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_viewings;
