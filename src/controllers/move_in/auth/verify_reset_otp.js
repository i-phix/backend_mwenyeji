const db = require('payservedb');
const logger = require('../../../../config/winston');

// POST /api/move_in/auth/verify_reset_otp
const verify_reset_otp = async (request, reply) => {
    try {
        const { email, otp } = request.body;
        if (!email || !otp) return reply.code(400).send({ error: 'Email and OTP are required.' });

        const record = await db.moveIn.MoveInOtp.findOne({
            email: email.toLowerCase().trim(),
            otp,
            used: false,
            expiresAt: { $gt: new Date() },
        });

        if (!record) {
            return reply.code(400).send({ error: 'Invalid or expired code.' });
        }

        return reply.code(200).send({ success: true, message: 'Code verified.' });
    } catch (err) {
        logger.error('[move_in/verify_reset_otp] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = verify_reset_otp;
