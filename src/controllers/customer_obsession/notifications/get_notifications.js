const payservedb = require('payservedb');
const logger = require('../../../../config/winston');

async function get_notifications(request, reply) {
    try {
        const agent = request.user;
        const { limit = 20, unread_only = false } = request.query;

        console.log('Fetching notifications for user:', {
            userId: agent.userId,
            agentId: agent.agent?._id,
            agentEmail: agent.email
        });

        const query = {
            user_id: agent.userId
        };

        if (unread_only === 'true') {
            query.is_read = false;
        }

        console.log('Notification query:', query);

        const notifications = await payservedb.AgentNotification
            .find(query)
            .sort({ created_at: -1 })
            .limit(parseInt(limit))
            .lean();

        console.log(`Found ${notifications.length} notifications`);

        const unreadCount = await payservedb.AgentNotification.countDocuments({
            user_id: agent.userId,
            is_read: false
        });

        console.log(`Unread count: ${unreadCount}`);

        return reply.code(200).send({
            success: true,
            data: notifications,
            unread_count: unreadCount
        });

    } catch (error) {
        logger.error(`Error fetching notifications: ${error.message}`);
        return reply.code(500).send({
            success: false,
            error: 'Failed to fetch notifications'
        });
    }
}

module.exports = get_notifications;
