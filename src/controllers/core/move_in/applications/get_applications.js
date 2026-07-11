const db = require('payservedb');
const logger = require('../../../../../config/winston');
const { filterSortPaginate } = require('../../../move_in/utils/workflow_context');

// GET /api/core/move_in/applications
const get_applications = async (request, reply) => {
    try {
        const result = await filterSortPaginate({
            model: db.moveIn.MoveInApplication,
            relatedType: 'application',
            baseFilter: {},
            query: request.query,
            defaultLimit: 20,
        });

        return reply.code(200).send({
            success: true,
            data: result.data,
            pagination: result.pagination,
        });
    } catch (err) {
        logger.error('[core/move_in/applications/get] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_applications;
