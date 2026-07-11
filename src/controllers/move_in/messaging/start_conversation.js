const db = require('payservedb');
const logger = require('../../../../config/winston');

// POST /api/move_in/messaging/conversations
// Start a conversation with a landlord about a unit
const start_conversation = async (request, reply) => {
    try {
        const { userId } = request.user;
        const { landlordId, unitId, unitName, firstMessage } = request.body;
        if (!landlordId || !unitId) return reply.code(400).send({ error: 'landlordId and unitId are required.' });
        if (!firstMessage?.trim()) return reply.code(400).send({ error: 'firstMessage is required.' });

        // Check for existing active conversation
        let conv = await db.moveIn.MoveInConversation.findOne({ tenantId: userId, landlordId, unitId, status: 'active' });

        if (!conv) {
            conv = await db.moveIn.MoveInConversation.create({
                tenantId: userId,
                landlordId,
                unitId,
                unitName: unitName || null,
                status: 'active',
            });
        }

        // Send first message
        const message = await db.moveIn.MoveInMessage.create({
            conversationId: conv._id,
            senderId: userId,
            senderType: 'tenant',
            body: firstMessage.trim(),
        });

        conv.lastMessage = firstMessage.trim();
        conv.lastMessageAt = new Date();
        conv.landlordUnread += 1;
        await conv.save();

        logger.info(`[move_in] Conversation started: tenant ${userId} → landlord ${landlordId}, unit ${unitId}`);
        return reply.code(200).send({ success: true, data: { conversationId: conv._id, message } });
    } catch (err) {
        logger.error('[move_in/messaging/start] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = start_conversation;
