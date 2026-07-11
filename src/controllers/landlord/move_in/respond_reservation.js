const { ensureMoveInLandlordForPayServeUser, sendError } = require('./context');
const respondReservation = require('../../move_in/landlord/features/respond_reservation');

module.exports = async function respond_landlord_move_in_reservation(request, reply) {
    try {
        const { moveInLandlord } = await ensureMoveInLandlordForPayServeUser(request.user.userId);
        request.user = { ...request.user, payserveUserId: request.user.userId, userId: moveInLandlord._id };
        return respondReservation(request, reply);
    } catch (err) {
        return sendError(reply, err);
    }
};
