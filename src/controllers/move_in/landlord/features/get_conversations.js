const db = require('payservedb');
const logger = require('../../../../../config/winston');

// GET /api/move_in/landlord/messaging/conversations
const get_conversations = async (request, reply) => {
    try {
        const { userId } = request.user;
        const conversations = await db.moveIn.MoveInConversation.find({ landlordId: userId, status: 'active' })
            .sort({ lastMessageAt: -1 })
            .lean();
        return reply.code(200).send({ success: true, data: conversations });
    } catch (err) {
        logger.error('[move_in/landlord/get_conversations] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_conversations;
