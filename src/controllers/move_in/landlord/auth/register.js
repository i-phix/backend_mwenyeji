const db = require('payservedb');
const bcrypt = require('bcryptjs');
const logger = require('../../../../../config/winston');
const { notifyEmail, notifyConfiguredAdmins } = require('../../utils/notifications');

// POST /api/move_in/landlord/auth/register
// Registers a standalone Move-In landlord (no PayServe account required).
const register = async (request, reply) => {
    try {
        const { fullName, email, phoneNumber, password, companyName } = request.body;

        if (!fullName || !email || !phoneNumber || !password) {
            return reply.code(400).send({ error: 'fullName, email, phoneNumber and password are required.' });
        }
        if (password.length < 8) {
            return reply.code(400).send({ error: 'Password must be at least 8 characters.' });
        }

        const existing = await db.moveIn.MoveInLandlordUser.findOne({ email: email.toLowerCase().trim() });
        if (existing) return reply.code(409).send({ error: 'An account with this email already exists.' });

        const existingPhone = await db.moveIn.MoveInLandlordUser.findOne({ phoneNumber: phoneNumber.trim() });
        if (existingPhone) return reply.code(409).send({ error: 'An account with this phone number already exists.' });

        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(password, salt);

        const landlord = await db.moveIn.MoveInLandlordUser.create({
            fullName: fullName.trim(),
            email: email.toLowerCase().trim(),
            phoneNumber: phoneNumber.trim(),
            password: hashed,
            companyName: companyName?.trim() || null,
            isEnabled: true,
            payserveUserId: null,
        });

        logger.info(`[move_in/landlord] New standalone landlord registered: ${landlord.email}`);
        await notifyEmail({
            to: landlord.email,
            subject: 'Welcome to Move-In by PayServe',
            text: `Hi ${landlord.fullName},\n\nYour landlord account has been created. You can now add units for admin review.\n\nMove-In by PayServe`,
        });
        await notifyConfiguredAdmins({
            subject: 'New Move-In landlord registered',
            text: `${landlord.fullName} (${landlord.email}) registered as a Move-In landlord.`,
        });
        return reply.code(200).send({ success: true, message: 'Account created. You can now log in.' });
    } catch (err) {
        logger.error('[move_in/landlord/register] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = register;
