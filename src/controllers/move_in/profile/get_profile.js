const db = require('payservedb');
const logger = require('../../../../config/winston');

// GET /api/move_in/profile
// JWT userId is MoveInUser._id (issued by /api/move_in/auth/login).
const get_profile = async (request, reply) => {
    try {
        const { userId } = request.user;

        const profile = await db.moveIn.MoveInUser.findById(userId).select('-password').lean();
        if (!profile) return reply.code(404).send({ error: 'Profile not found.' });

        return reply.code(200).send({ success: true, data: profile });
    } catch (err) {
        logger.error('[move_in/profile/get] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_profile;
