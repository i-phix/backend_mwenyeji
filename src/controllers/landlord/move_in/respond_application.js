const { ensureMoveInLandlordForPayServeUser, sendError } = require('./context');
const respondApplication = require('../../move_in/landlord/features/respond_application');

module.exports = async function respond_landlord_move_in_application(request, reply) {
    try {
        const { moveInLandlord } = await ensureMoveInLandlordForPayServeUser(request.user.userId);
        request.user = { ...request.user, payserveUserId: request.user.userId, userId: moveInLandlord._id };
        return respondApplication(request, reply);
    } catch (err) {
        return sendError(reply, err);
    }
};
