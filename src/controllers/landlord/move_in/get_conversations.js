const db = require('payservedb');
const logger = require('../../../../config/winston');
const { ensureMoveInLandlordForPayServeUser, landlordRecordFilter, sendError } = require('./context');

// GET /api/landlord/move_in/messaging/conversations
const get_conversations = async (request, reply) => {
    try {
        const { userId } = request.user;

        const { moveInLandlord } = await ensureMoveInLandlordForPayServeUser(userId);
        const conversations = await db.moveIn.MoveInConversation.find({
            ...landlordRecordFilter({ payserveUserId: userId, moveInLandlordId: moveInLandlord._id }),
            status: 'active',
        }).sort({ lastMessageAt: -1 }).lean();

        return reply.code(200).send({ success: true, data: conversations });
    } catch (err) {
        logger.error('[landlord/move_in/get_conversations] ' + err.message);
        return sendError(reply, err);
    }
};

module.exports = get_conversations;
