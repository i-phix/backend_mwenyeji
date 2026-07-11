const db = require('payservedb');
const logger = require('../../../../config/winston');
const { ensureMoveInLandlordForPayServeUser, landlordRecordFilter, sendError } = require('./context');

// GET /api/landlord/move_in/viewing/bookings
const get_viewing_bookings = async (request, reply) => {
    try {
        const { userId } = request.user;
        const { status = 'All' } = request.query;

        const { moveInLandlord } = await ensureMoveInLandlordForPayServeUser(userId);
        const filter = landlordRecordFilter({ payserveUserId: userId, moveInLandlordId: moveInLandlord._id });
        if (status !== 'All') filter.status = status;

        const bookings = await db.moveIn.MoveInBooking.find(filter).sort({ scheduledDate: -1 }).lean();
        return reply.code(200).send({ success: true, data: bookings });
    } catch (err) {
        logger.error('[landlord/move_in/get_viewing_bookings] ' + err.message);
        return sendError(reply, err);
    }
};

module.exports = get_viewing_bookings;
