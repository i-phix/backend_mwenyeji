const db = require('payservedb');
const generate_jwt_token = require('../../../../utils/generate_jwt_token');
const logger = require('../../../../../config/winston');

// POST /api/move_in/landlord/auth/verify-handoff
// Consumes a one-time handoff token and returns a Move-In landlord JWT.
// No authentication middleware required — the handoff token IS the credential.
const verify_handoff = async (request, reply) => {
    try {
        const { handoffToken } = request.body;
        if (!handoffToken) return reply.code(400).send({ error: 'handoffToken is required.' });

        const record = await db.moveIn.MoveInHandoffToken.findOne({
            token: handoffToken,
            used: false,
            expiresAt: { $gt: new Date() },
        });

        if (!record) {
            return reply.code(401).send({ error: 'Invalid or expired handoff token.' });
        }

        // Mark as used immediately (single-use)
        record.used = true;
        await record.save();

        const landlord = await db.moveIn.MoveInLandlordUser.findById(record.landlordId).lean();
        if (!landlord || !landlord.isEnabled) {
            return reply.code(403).send({ error: 'Landlord account not found or inactive.' });
        }

        const payload = {
            userId:   landlord._id,
            type:     'MoveInLandlordUser',
            role:     'landlord',
            fullName: landlord.fullName,
            email:    landlord.email,
            source:   'movein',
        };

        const result = await generate_jwt_token(payload, 'MoveInLandlordUser');
        logger.info(`[move_in/landlord] Handoff verified for: ${landlord.email}`);

        return reply.code(200).send({
            success: true,
            user: payload,
            authToken: result.authToken,
            refreshToken: result.refreshToken,
        });
    } catch (err) {
        logger.error('[move_in/landlord/verify_handoff] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = verify_handoff;
