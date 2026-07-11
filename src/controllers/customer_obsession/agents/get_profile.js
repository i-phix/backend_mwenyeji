const payservedb = require('payservedb');
const logger = require('../../../../config/winston');

const get_profile = async (request, reply) => {
    try {
        const agent = request.user;

        console.log('=== Get Agent Profile ===');
        console.log('User ID:', agent.userId);

        // Find the agent by user_id
        const agentData = await payservedb.Agent.findOne({ user_id: agent.userId })
            .populate('facility_id', 'name')
            .lean();

        if (!agentData) {
            console.log('Agent not found for user_id:', agent.userId);
            return reply.code(404).send({
                success: false,
                error: 'Agent not found'
            });
        }

        console.log('Agent data found:', agentData.agent_id);

        // Get user details
        const user = await payservedb.User.findById(agent.userId).lean();

        // Get role details
        const role = await payservedb.AgentRole.findOne({ code: agentData.role }).lean();

        // Get department details
        const department = await payservedb.AgentDepartment.findOne({ code: agentData.department }).lean();

        // Extract first and last name from user's fullName
        const fullName = user?.fullName || '';
        const nameParts = fullName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        // Combine all the data - user details from User table, agent data from Agent table
        const profile = {
            agent_id: agentData.agent_id,
            first_name: firstName,
            last_name: lastName,
            email: user?.email || agentData.email,
            phone_number: user?.phoneNumber || agentData.phone,
            role: role || { name: agentData.role, code: agentData.role },
            department: department || { name: agentData.department, code: agentData.department },
            facility: agentData.facility_id || null,
            status: agentData.status,
            profile_image: agentData.profile_image || null,
            created_at: agentData.created_at,
            updated_at: agentData.updated_at
        };

        logger.info(`Profile retrieved for agent ${agentData.agent_id}`);

        return reply.code(200).send({
            success: true,
            data: profile
        });

    } catch (error) {
        console.error('Get profile error:', error);
        logger.error(`Error getting agent profile: ${error.message}`, { stack: error.stack });

        return reply.code(500).send({
            success: false,
            error: 'Failed to get agent profile'
        });
    }
};

module.exports = get_profile;
