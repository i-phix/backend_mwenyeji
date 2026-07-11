const { ensureMoveInLandlordForPayServeUser, sendError } = require('./context');
const getApplications = require('../../move_in/landlord/features/get_applications');

module.exports = async function get_landlord_move_in_applications(request, reply) {
    try {
        const { moveInLandlord } = await ensureMoveInLandlordForPayServeUser(request.user.userId);
        request.user = { ...request.user, payserveUserId: request.user.userId, userId: moveInLandlord._id };
        return getApplications(request, reply);
    } catch (err) {
        return sendError(reply, err);
    }
};
