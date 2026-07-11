const db = require('payservedb');
const bcrypt = require('bcryptjs');
const logger = require('../../../../config/winston');

// POST /api/move_in/auth/reset_password
const reset_password = async (request, reply) => {
    try {
        const { email, otp, newPassword } = request.body;
        if (!email || !otp || !newPassword) {
            return reply.code(400).send({ error: 'email, otp, and newPassword are required.' });
        }
        if (newPassword.length < 8) {
            return reply.code(400).send({ error: 'Password must be at least 8 characters.' });
        }

        const record = await db.moveIn.MoveInOtp.findOne({
            email: email.toLowerCase().trim(),
            otp,
            used: false,
            expiresAt: { $gt: new Date() },
        });

        if (!record) {
            return reply.code(400).send({ error: 'Invalid or expired code.' });
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        await db.moveIn.MoveInUser.updateOne(
            { email: email.toLowerCase().trim() },
            { password: hashed }
        );

        record.used = true;
        await record.save();

        logger.info(`[move_in] Password reset for ${email}`);
        return reply.code(200).send({ success: true, message: 'Password reset successfully.' });
    } catch (err) {
        logger.error('[move_in/reset_password] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = reset_password;
