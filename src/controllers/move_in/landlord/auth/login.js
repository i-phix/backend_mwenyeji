const db = require('payservedb');
const bcrypt = require('bcryptjs');
const generate_jwt_token = require('../../../../utils/generate_jwt_token');
const logger = require('../../../../../config/winston');

// POST /api/move_in/landlord/auth/login
// Works for both standalone Move-In landlords and PayServe-linked landlords.
// PayServe landlords authenticate against payserve_property; their MoveInLandlordUser
// is auto-provisioned on first login.
const login = async (request, reply) => {
    try {
        const { email, password } = request.body;
        if (!email || !password) return reply.code(400).send({ error: 'Email and password are required.' });

        const normalizedEmail = email.toLowerCase().trim();

        // 1. Check for existing MoveInLandlordUser
        let landlord = await db.moveIn.MoveInLandlordUser.findOne({ email: normalizedEmail });

        if (landlord) {
            if (!landlord.isEnabled) {
                return reply.code(403).send({ error: 'Your account has been suspended.' });
            }

            if (landlord.payserveUserId) {
                // PayServe-linked: verify against payserve_property User password
                const psUser = await db.User.findById(landlord.payserveUserId).select('password isEnabled').lean();
                if (!psUser || !psUser.isEnabled) {
                    return reply.code(403).send({ error: 'Your PayServe account is inactive.' });
                }
                const match = await bcrypt.compare(password, psUser.password);
                if (!match) return reply.code(403).send({ error: 'Email or password is invalid.' });
            } else {
                // Standalone: verify against MoveInLandlordUser password
                const match = await bcrypt.compare(password, landlord.password);
                if (!match) return reply.code(403).send({ error: 'Email or password is invalid.' });
            }
        } else {
            // 2. No MoveInLandlordUser found — check if email belongs to a PayServe Landlord
            const psUser = await db.User.findOne({ email: normalizedEmail, type: 'Landlord' })
                .select('_id fullName email phoneNumber password isEnabled')
                .lean();

            if (!psUser) return reply.code(403).send({ error: 'Email or password is invalid.' });
            if (!psUser.isEnabled) return reply.code(403).send({ error: 'Your account has been suspended.' });

            const match = await bcrypt.compare(password, psUser.password);
            if (!match) return reply.code(403).send({ error: 'Email or password is invalid.' });

            // Auto-provision MoveInLandlordUser
            landlord = await db.moveIn.MoveInLandlordUser.create({
                fullName:       psUser.fullName || psUser.email,
                email:          normalizedEmail,
                phoneNumber:    psUser.phoneNumber || '0000000000',
                password:       'MANAGED_BY_PAYSERVE',
                isEnabled:      true,
                payserveUserId: psUser._id,
            });
            logger.info(`[move_in/landlord] Auto-provisioned MoveInLandlordUser for PayServe landlord: ${normalizedEmail}`);
        }

        const payload = {
            userId:      landlord._id,
            type:        'MoveInLandlordUser',
            role:        'landlord',
            fullName:    landlord.fullName,
            email:       landlord.email,
            source:      'movein',
        };

        const result = await generate_jwt_token(payload, 'MoveInLandlordUser');
        logger.info(`[move_in/landlord] Landlord logged in: ${landlord.email}`);

        return reply.code(200).send({
            success: true,
            user: payload,
            authToken: result.authToken,
            refreshToken: result.refreshToken,
        });
    } catch (err) {
        logger.error('[move_in/landlord/login] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = login;
