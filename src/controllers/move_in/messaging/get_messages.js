const db = require('payservedb');
const logger = require('../../../../config/winston');

// GET /api/move_in/messaging/conversations/:conversationId/messages
const get_messages = async (request, reply) => {
    try {
        const { userId } = request.user;
        const { conversationId } = request.params;
        const { page = 1, limit = 30 } = request.query;

        // Verify tenant owns this conversation
        const conv = await db.moveIn.MoveInConversation.findOne({ _id: conversationId, tenantId: userId });
        if (!conv) return reply.code(404).send({ error: 'Conversation not found.' });

        const skip = (Number(page) - 1) * Number(limit);
        const messages = await db.moveIn.MoveInMessage.find({ conversationId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean();

        // Mark tenant's unread messages as read
        await db.moveIn.MoveInMessage.updateMany(
            { conversationId, senderType: 'landlord', isRead: false },
            { isRead: true, readAt: new Date() }
        );
        await db.moveIn.MoveInConversation.updateOne({ _id: conversationId }, { tenantUnread: 0 });

        return reply.code(200).send({ success: true, data: messages.reverse() });
    } catch (err) {
        logger.error('[move_in/messaging/get_messages] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_messages;
