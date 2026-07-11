const db = require('payservedb');
const logger = require('../../../../../config/winston');

// POST /api/move_in/landlord/messaging/conversations/:conversationId/messages
const send_message = async (request, reply) => {
    try {
        const { userId } = request.user;
        const { conversationId } = request.params;
        const { body } = request.body;
        if (!body?.trim()) return reply.code(400).send({ error: 'Message body is required.' });

        const conv = await db.moveIn.MoveInConversation.findOne({ _id: conversationId, landlordId: userId });
        if (!conv) return reply.code(404).send({ error: 'Conversation not found.' });
        if (conv.status === 'closed') return reply.code(400).send({ error: 'Conversation is closed.' });

        const message = await db.moveIn.MoveInMessage.create({
            conversationId,
            senderId:   userId,
            senderType: 'landlord',
            body:       body.trim(),
        });

        conv.lastMessage   = body.trim();
        conv.lastMessageAt = new Date();
        conv.tenantUnread += 1;
        await conv.save();

        await db.moveIn.MoveInNotification.create({
            recipientId:   conv.tenantId,
            recipientType: 'tenant',
            title:         'New Message from Landlord',
            body:          `"${body.trim().slice(0, 80)}"`,
            type:          'message',
            relatedId:     conv._id,
        });

        return reply.code(200).send({ success: true, data: message });
    } catch (err) {
        logger.error('[move_in/landlord/send_message] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = send_message;
