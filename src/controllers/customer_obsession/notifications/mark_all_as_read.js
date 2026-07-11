const payservedb = require('payservedb');
const logger = require('../../../../config/winston');

async function mark_all_as_read(request, reply) {
    try {
        const agent = request.user;

        await payservedb.AgentNotification.updateMany(
            {
                user_id: agent.userId,
                is_read: false
            },
            {
                is_read: true,
                read_at: new Date()
            }
        );

        return reply.code(200).send({
            success: true,
            message: 'All notifications marked as read'
        });

    } catch (error) {
        logger.error(`Error marking all notifications as read: ${error.message}`);
        return reply.code(500).send({
            success: false,
            error: 'Failed to mark all notifications as read'
        });
    }
}

module.exports = mark_all_as_read;
