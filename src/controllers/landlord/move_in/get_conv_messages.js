const db = require('payservedb');
const logger = require('../../../../config/winston');
const { ensureMoveInLandlordForPayServeUser, landlordRecordFilter, sendError } = require('./context');

// GET /api/landlord/move_in/messaging/conversations/:conversationId/messages
const get_conv_messages = async (request, reply) => {
    try {
        const { userId } = request.user;
        const { conversationId } = request.params;

        const { moveInLandlord } = await ensureMoveInLandlordForPayServeUser(userId);
        const conv = await db.moveIn.MoveInConversation.findOne({
            _id: conversationId,
            ...landlordRecordFilter({ payserveUserId: userId, moveInLandlordId: moveInLandlord._id }),
        });
        if (!conv) return reply.code(404).send({ error: 'Conversation not found.' });

        const messages = await db.moveIn.MoveInMessage.find({ conversationId }).sort({ createdAt: 1 }).lean();

        // Mark landlord's unread messages as read
        await db.moveIn.MoveInMessage.updateMany(
            { conversationId, senderType: 'tenant', isRead: false },
            { isRead: true, readAt: new Date() }
        );
        await db.moveIn.MoveInConversation.updateOne({ _id: conversationId }, { landlordUnread: 0 });

        return reply.code(200).send({ success: true, data: messages });
    } catch (err) {
        logger.error('[landlord/move_in/get_messages] ' + err.message);
        return sendError(reply, err);
    }
};

module.exports = get_conv_messages;
