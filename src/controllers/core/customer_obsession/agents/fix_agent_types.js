const payservedb = require("payservedb");
const logger = require('../../../../../config/winston');

const fix_agent_types = async (request, reply) => {
    try {
        logger.info("Starting agent type fix process");

        // Find all agents
        const agents = await payservedb.Agent.find({});

        if (agents.length === 0) {
            return reply.code(200).send({
                success: true,
                message: 'No agents found to update',
                updated: 0
            });
        }

        let updateCount = 0;
        const updateResults = [];

        for (const agent of agents) {
            try {
                // Find the corresponding user
                const user = await payservedb.User.findById(agent.user_id);

                if (user && user.type !== 'Customer_Support') {
                    // Update user type to Customer_Support
                    await payservedb.User.findByIdAndUpdate(
                        agent.user_id,
                        { type: 'Customer_Support' },
                        { new: true }
                    );

                    updateCount++;
                    updateResults.push({
                        agent_id: agent.agent_id,
                        user_email: user.email,
                        old_type: user.type,
                        new_type: 'Customer_Support'
                    });

                    logger.info(`Updated user type for agent ${agent.agent_id} (${user.email})`);
                }
            } catch (agentError) {
                logger.error(`Error updating agent ${agent.agent_id}:`, agentError.message);
                updateResults.push({
                    agent_id: agent.agent_id,
                    error: agentError.message
                });
            }
        }

        logger.info(`Agent type fix completed. Updated ${updateCount} agents.`);

        return reply.code(200).send({
            success: true,
            message: `Successfully updated ${updateCount} agent user types`,
            total_agents: agents.length,
            updated: updateCount,
            details: updateResults
        });

    } catch (err) {
        logger.error('Error in fix_agent_types:', err.message);
        return reply.code(500).send({
            success: false,
            error: err.message
        });
    }
};

module.exports = fix_agent_types;