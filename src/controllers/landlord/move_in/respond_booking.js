const { ensureMoveInLandlordForPayServeUser } = require('./context');
const respondBooking = require('../../move_in/landlord/features/respond_booking');

module.exports = async function respond_landlord_move_in_viewing_booking(request, reply) {
    const originalUserId = request.user.userId;
    try {
        const { moveInLandlord } = await ensureMoveInLandlordForPayServeUser(originalUserId);
        request.user.userId = moveInLandlord._id;
        return respondBooking(request, reply);
    } finally {
        request.user.userId = originalUserId;
    }
};
