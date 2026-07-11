const payservedb = require('payservedb');
const logger = require('../../../../../config/winston');


const delete_agent = async (request, reply) => {
    try {
        const { id } = request.params;
        const { permanent = false } = request.query; // Option for permanent deletion

        if (!id) {
            return reply.code(400).send({
                error: 'Agent ID is required'
            });
        }

        // Find the agent
        const agent = await payservedb.Agent.findOne({
            $or: [
                { _id: id },
                { agent_id: id }
            ]
        });

        if (!agent) {
            return reply.code(404).send({
                error: 'Agent not found'
            });
        }

        // Check if agent has active tickets before deletion
        const activeTickets = await payservedb.CustomerTicket.countDocuments({
            $or: [
                { agent_id: agent._id },
                { assigned_to: agent._id }
            ],
            status: { $in: ['open', 'in_progress', 'escalated'] }
        });

        if (activeTickets > 0) {
            return reply.code(400).send({
                error: `Cannot delete agent. Agent has ${activeTickets} active tickets. Please reassign tickets before deletion.`
            });
        }

        let result;

        if (permanent === 'true') {
            // Permanent deletion
            result = await payservedb.Agent.findByIdAndDelete(agent._id);
            logger.info(`Agent permanently deleted: ${agent.agent_id}`);

            return reply.code(200).send({
                message: 'Agent permanently deleted',
                agent_id: agent.agent_id
            });
        } else {
            // Soft deletion - just deactivate the agent
            result = await payservedb.Agent.findByIdAndUpdate(
                agent._id,
                {
                    status: 'inactive',
                    deactivated_at: new Date(),
                    deactivated_by: request.user?.userId || 'system',
                    updatedAt: new Date()
                },
                { new: true }
            ).select('-password');

            logger.info(`Agent deactivated: ${agent.agent_id}`);

            return reply.code(200).send({
                message: 'Agent deactivated successfully',
                agent: result
            });
        }

    } catch (err) {
        logger.error(`Error deleting agent: ${err.message}`);
        console.log(err);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = delete_agent;