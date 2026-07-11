const db = require('payservedb');
const crypto = require('crypto');
const { sendEmail } = require('../../../utils/send_new_email');
const logger = require('../../../../config/winston');

// POST /api/move_in/auth/forgot_password
const forgot_password = async (request, reply) => {
    try {
        const { email } = request.body;
        if (!email) return reply.code(400).send({ error: 'Email is required.' });

        const user = await db.moveIn.MoveInUser.findOne({ email: email.toLowerCase().trim() }).lean();
        // Always return success to prevent email enumeration
        if (!user) {
            return reply.code(200).send({ success: true, message: 'If that email exists, a reset code has been sent.' });
        }

        // Generate 6-digit OTP
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        // Invalidate previous OTPs for this email
        await db.moveIn.MoveInOtp.updateMany({ email: email.toLowerCase().trim(), used: false }, { used: true });

        await db.moveIn.MoveInOtp.create({ email: email.toLowerCase().trim(), otp, expiresAt });
        const frontendUrl = process.env.MOVE_IN_FRONTEND_URL || process.env.moveInFrontEndUrl || 'http://localhost:3000';
        const resetUrl = `${frontendUrl}/reset-password?email=${encodeURIComponent(user.email)}&otp=${encodeURIComponent(otp)}`;

        await sendEmail(
            null,
            user.email,
            'Reset your Move-In password',
            `Hi ${user.fullName},\n\nUse this secure link to reset your password:\n${resetUrl}\n\nYour reset code is: ${otp}\n\nThis code expires in 15 minutes. If you did not request this, ignore this email.\n\nMove-In by PayServe`
        ).catch((e) => logger.error('[move_in/forgot_password] email error: ' + e.message));

        return reply.code(200).send({ success: true, message: 'If that email exists, a reset code has been sent.' });
    } catch (err) {
        logger.error('[move_in/forgot_password] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = forgot_password;
