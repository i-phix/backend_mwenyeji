const db = require('payservedb');
const logger = require('../../../../config/winston');

// PUT /api/move_in/notifications/read/:notificationId
const mark_read = async (request, reply) => {
    try {
        const userId = request.user.userId || request.user._id || request.user.id;
        const { notificationId } = request.params;

        await db.moveIn.MoveInNotification.updateOne(
            { _id: notificationId, recipientId: userId },
            { isRead: true, readAt: new Date() }
        );

        return reply.code(200).send({ success: true });
    } catch (err) {
        logger.error('[move_in/notifications/mark_read] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = mark_read;
