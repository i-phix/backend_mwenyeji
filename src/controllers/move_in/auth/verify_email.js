const db = require('payservedb');
const logger = require('../../../../config/winston');

// GET /api/move_in/auth/verify_email/:token
const verify_email = async (request, reply) => {
    try {
        const { token } = request.params;
        if (!token) return reply.code(400).send({ error: 'Verification token is required.' });

        const user = await db.moveIn.MoveInUser.findOne({
            emailVerificationToken: token,
            emailVerificationExpiresAt: { $gt: new Date() },
        });

        if (!user) {
            return reply.code(400).send({ error: 'Invalid or expired verification link.' });
        }

        user.isEmailVerified = true;
        user.emailVerificationToken = null;
        user.emailVerificationExpiresAt = null;
        await user.save();

        return reply.code(200).send({ success: true, message: 'Email verified.' });
    } catch (err) {
        logger.error('[move_in/verify_email] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = verify_email;
