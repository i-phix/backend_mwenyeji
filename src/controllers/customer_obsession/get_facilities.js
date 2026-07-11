const payservedb = require('payservedb');
const logger = require('../../../config/winston');

async function get_facilities(request, reply) {
    try {
        const agent = request.user;

        // Get facilities based on agent's permissions
        let facilities;

        if (['manager', 'supervisor'].includes(agent.agent?.role)) {
            // Managers and supervisors can see all facilities
            facilities = await payservedb.Facility.find({ isEnabled: true })
                .select('name location subDivision isOnboarded _id')
                .sort({ name: 1 });
        } else {
            // Regular agents see all enabled facilities (can be customized later)
            facilities = await payservedb.Facility.find({ isEnabled: true })
                .select('name location subDivision isOnboarded _id')
                .sort({ name: 1 });
        }

        logger.info(`Agent ${agent.agent?.agent_id} retrieved ${facilities.length} facilities`);

        return reply.code(200).send({
            success: true,
            data: facilities
        });

    } catch (error) {
        logger.error(`Error retrieving facilities: ${error.message}`);
        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve facilities'
        });
    }
}

module.exports = get_facilities;