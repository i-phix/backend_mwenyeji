const db = require('payservedb');
const logger = require('../../../../../config/winston');

const getDepartments = async (request, reply) => {
    try {
        const { include_archived } = request.query;

        // Build query
        const query = {};
        if (include_archived !== 'true') {
            query.active = { $ne: false };
        }

        // Fetch departments
        const departments = await db.AgentDepartment.find(query)
            .populate('created_by', 'fullName email')
            .populate('updated_by', 'fullName email')
            .populate('archived_by', 'fullName email')
            .sort({ name: 1 })
            .lean();

        logger.info(`Fetched ${departments.length} departments`);

        return reply.code(200).send({
            success: true,
            message: 'Departments retrieved successfully',
            data: departments
        });

    } catch (error) {
        logger.error(`Error fetching departments: ${error.message}`, { stack: error.stack });
        return reply.code(500).send({
            success: false,
            error: 'Failed to fetch departments'
        });
    }
};

module.exports = getDepartments;
