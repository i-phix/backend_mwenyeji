const db = require('payservedb');
const logger = require('../../../../config/winston');

// PUT /api/move_in/notifications/read_all
const mark_all_read = async (request, reply) => {
    try {
        const { role, type } = request.user;
        const userId = request.user.userId || request.user._id || request.user.id;
        const recipientType = role === 'admin' || (type && !['MoveInUser', 'MoveInLandlordUser'].includes(type))
            ? 'admin'
            : (role === 'landlord' || type === 'MoveInLandlordUser' ? 'landlord' : 'tenant');

        await db.moveIn.MoveInNotification.updateMany(
            { recipientId: userId, recipientType, isRead: false },
            { isRead: true, readAt: new Date() }
        );

        return reply.code(200).send({ success: true });
    } catch (err) {
        logger.error('[move_in/notifications/mark_all_read] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = mark_all_read;
