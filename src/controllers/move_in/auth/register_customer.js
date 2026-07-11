const db = require('payservedb');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendEmail } = require('../../../utils/send_new_email');
const logger = require('../../../../config/winston');

// POST /api/move_in/auth/register
// Registers a new tenant in the payserve_movein database (MoveInUser).
// These users are completely separate from payserve_property Users.
const register_customer = async (request, reply) => {
    try {
        const { fullName, email, phoneNumber, password } = request.body;

        if (!fullName || !email || !phoneNumber || !password) {
            return reply.code(400).send({ error: 'Full name, email, phone number, and password are required.' });
        }

        if (password.length < 8) {
            return reply.code(400).send({ error: 'Password must be at least 8 characters.' });
        }

        const normalizedPhone = phoneNumber.replace(/\D/g, '').slice(-9);

        const existingEmail = await db.moveIn.MoveInUser.findOne({ email: email.toLowerCase().trim() });
        if (existingEmail) {
            return reply.code(409).send({ error: 'An account with this email already exists.' });
        }

        const existingPhone = await db.moveIn.MoveInUser.findOne({ phoneNumber: normalizedPhone });
        if (existingPhone) {
            return reply.code(409).send({ error: 'An account with this phone number already exists.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const verificationToken = crypto.randomBytes(32).toString('hex');

        const newUser = new db.moveIn.MoveInUser({
            fullName: fullName.trim(),
            email: email.toLowerCase().trim(),
            phoneNumber: normalizedPhone,
            password: hashedPassword,
            isEnabled: true,
            isEmailVerified: false,
            emailVerificationToken: verificationToken,
            emailVerificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });

        await newUser.save();

        const frontendUrl = process.env.MOVE_IN_FRONTEND_URL || process.env.moveInFrontEndUrl || 'http://localhost:3000';
        const verifyUrl = `${frontendUrl}/verify-email/${verificationToken}`;
        await sendEmail(
            null,
            newUser.email,
            'Verify your Move-In email',
            `Hi ${newUser.fullName},\n\nWelcome to Move-In by PayServe. Verify your email using this link:\n${verifyUrl}\n\nThis link expires in 24 hours.`
        ).catch((e) => logger.error('[move_in/register] verification email error: ' + e.message));

        logger.info(`[move_in] New tenant registered: ${newUser.email}`);

        return reply.code(200).send({
            success: true,
            message: 'Account created successfully. Check your email to verify your account.',
            data: { userId: newUser._id },
        });
    } catch (err) {
        logger.error('[move_in/register] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = register_customer;
