const db = require('payservedb');
const logger = require('../../../../config/winston');

// GET /api/move_in/notifications
const get_notifications = async (request, reply) => {
    try {
        const { role, type } = request.user;
        const userId = request.user.userId || request.user._id || request.user.id;
        const { page = 1, limit = 20 } = request.query;

        const recipientType = role === 'admin' || (type && !['MoveInUser', 'MoveInLandlordUser'].includes(type))
            ? 'admin'
            : (role === 'landlord' || type === 'MoveInLandlordUser' ? 'landlord' : 'tenant');
        const filter = { recipientId: userId, recipientType };
        const total = await db.moveIn.MoveInNotification.countDocuments(filter);
        const skip = (Number(page) - 1) * Number(limit);

        const notifications = await db.moveIn.MoveInNotification.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean();

        const unreadCount = await db.moveIn.MoveInNotification.countDocuments({ ...filter, isRead: false });

        return reply.code(200).send({
            success: true,
            data: notifications,
            unreadCount,
            pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
        });
    } catch (err) {
        logger.error('[move_in/notifications/get] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_notifications;
