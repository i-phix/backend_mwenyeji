const { ensureMoveInLandlordForPayServeUser, sendError } = require('./context');
const getReservations = require('../../move_in/landlord/features/get_reservations');

module.exports = async function get_landlord_move_in_reservations(request, reply) {
    try {
        const { moveInLandlord } = await ensureMoveInLandlordForPayServeUser(request.user.userId);
        request.user = { ...request.user, payserveUserId: request.user.userId, userId: moveInLandlord._id };
        return getReservations(request, reply);
    } catch (err) {
        return sendError(reply, err);
    }
};
