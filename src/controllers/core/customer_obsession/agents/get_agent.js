const payservedb = require('payservedb');
const logger = require('../../../../../config/winston');

const get_agent = async (request, reply) => {
    try {
        const { id } = request.params;

        if (!id) {
            return reply.code(400).send({
                error: 'Agent ID is required'
            });
        }

        // Find agent by ID or agent_id
        const agent = await payservedb.Agent
            .findOne({
                $or: [
                    { _id: id },
                    { agent_id: id }
                ]
            })
            .select('-password') // Exclude password field
            .populate('facility_id', 'facilityName facilityType facilityAddress')
            .populate('created_by', 'firstName lastName')
            .populate('updated_by', 'firstName lastName');

        if (!agent) {
            return reply.code(404).send({
                error: 'Agent not found'
            });
        }

        logger.info(`Successfully retrieved agent: ${agent.agent_id}`);
        return reply.code(200).send(agent);

    } catch (err) {
        logger.error(`Error retrieving agent: ${err.message}`);
        console.log(err);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_agent;