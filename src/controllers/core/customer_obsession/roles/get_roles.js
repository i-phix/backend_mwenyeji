const db = require('payservedb');
const logger = require('../../../../../config/winston');

const getRoles = async (request, reply) => {
    try {
        const { include_archived } = request.query;

        // Build query
        const query = {};
        if (include_archived !== 'true') {
            query.active = { $ne: false };
        }

        // Fetch roles
        const roles = await db.AgentRole.find(query)
            .populate('created_by', 'fullName email')
            .populate('updated_by', 'fullName email')
            .populate('archived_by', 'fullName email')
            .populate('department', 'name code')
            .sort({ level: -1, name: 1 })
            .lean();

        logger.info(`Fetched ${roles.length} roles`);

        return reply.code(200).send({
            success: true,
            message: 'Roles retrieved successfully',
            data: roles
        });

    } catch (error) {
        logger.error(`Error fetching roles: ${error.message}`, { stack: error.stack });
        return reply.code(500).send({
            success: false,
            error: 'Failed to fetch roles'
        });
    }
};

module.exports = getRoles;
