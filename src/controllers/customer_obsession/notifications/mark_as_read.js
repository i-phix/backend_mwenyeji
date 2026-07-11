const payservedb = require('payservedb');
const logger = require('../../../../config/winston');

async function mark_as_read(request, reply) {
    try {
        const agent = request.user;
        const { notification_id } = request.params;

        await payservedb.AgentNotification.findOneAndUpdate(
            {
                _id: notification_id,
                user_id: agent.userId
            },
            {
                is_read: true,
                read_at: new Date()
            }
        );

        return reply.code(200).send({
            success: true,
            message: 'Notification marked as read'
        });

    } catch (error) {
        logger.error(`Error marking notification as read: ${error.message}`);
        return reply.code(500).send({
            success: false,
            error: 'Failed to mark notification as read'
        });
    }
}

module.exports = mark_as_read;
