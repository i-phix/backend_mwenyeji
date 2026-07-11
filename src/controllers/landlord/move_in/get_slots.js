const db = require('payservedb');
const logger = require('../../../../config/winston');
const { ensureMoveInLandlordForPayServeUser, landlordRecordFilter, sendError } = require('./context');

// GET /api/landlord/move_in/viewing/slots
const get_slots = async (request, reply) => {
    try {
        const { userId } = request.user;

        const { moveInLandlord } = await ensureMoveInLandlordForPayServeUser(userId);
        const slots = await db.moveIn.MoveInViewingSlot.find(landlordRecordFilter({
            payserveUserId: userId,
            moveInLandlordId: moveInLandlord._id,
        })).sort({ date: 1, time: 1 }).lean();
        const result = slots.map((s) => ({
            ...s,
            availableSeats: s.capacity - s.bookedCount,
        }));

        return reply.code(200).send({ success: true, data: result });
    } catch (err) {
        logger.error('[landlord/move_in/get_slots] ' + err.message);
        return sendError(reply, err);
    }
};

module.exports = get_slots;
