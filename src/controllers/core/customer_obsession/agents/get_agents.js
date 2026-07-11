const payservedb = require("payservedb");
const logger = require('../../../../../config/winston');

const get_agents = async (request, reply) => {
    try {
        const { facility_id, status, department, role, search, page = 1, limit = 10 } = request.query;

        logger.info("Retrieving agents - Request query:", request.query);

        // Build query filters
        let query = {};

        if (facility_id) {
            query.facility_id = facility_id;
        }

        if (status) {
            query.status = status;
        }

        if (department) {
            query.department = department;
        }

        if (role) {
            query.role = role;
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { agent_id: { $regex: search, $options: 'i' } }
            ];
        }

        logger.info("Query filters:", query);

        // Calculate pagination
        const skip = (page - 1) * limit;
        const totalCount = await payservedb.Agent.countDocuments(query);
        const totalPages = Math.ceil(totalCount / limit);

        logger.info(`Total agents found: ${totalCount}, Pages: ${totalPages}`);

        // Get agents with pagination and populate user info
        const agents = await payservedb.Agent
            .find(query)
            .populate('user_id', 'fullName email phoneNumber idNumber')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        logger.info(`Successfully retrieved ${agents.length} agents`);

        // Transform agents to match frontend expectations
        const transformedAgents = agents.map(agent => {
            const agentObj = agent.toObject();

            // Extract firstName and lastName from name field
            const nameParts = agentObj.name ? agentObj.name.split(' ') : ['', ''];

            return {
                _id: agentObj._id,
                agent_id: agentObj.agent_id,
                firstName: nameParts[0] || '',
                lastName: nameParts.slice(1).join(' ') || '',
                name: agentObj.name,
                email: agentObj.email,
                phoneNumber: agentObj.phone,
                phone: agentObj.phone,
                idNumber: agentObj.id_number,
                id_number: agentObj.id_number,
                department: agentObj.department,
                role: agentObj.role,
                status: agentObj.status,
                team_id: agentObj.team_id,
                facility_id: agentObj.facility_id,
                hire_date: agentObj.hire_date,
                performance_metrics: agentObj.performance_metrics,
                is_available: agentObj.is_available,
                createdAt: agentObj.createdAt,
                updatedAt: agentObj.updatedAt,
                user_info: agentObj.user_id
            };
        });

        logger.info("Agents transformed successfully");

        const responseData = {
            success: true,
            data: transformedAgents,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalCount,
                limit: parseInt(limit),
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        };

        logger.info("Sending response:", {
            success: responseData.success,
            dataLength: responseData.data.length,
            pagination: responseData.pagination
        });

        return reply.code(200).send(responseData);

    } catch (err) {
        logger.error(err.message);
        logger.error(err.stack);
        return reply.code(502).send({
            success: false,
            error: err.message
        });
    }
};

module.exports = get_agents;