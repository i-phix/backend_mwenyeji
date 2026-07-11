const db = require('payservedb');
const crypto = require('crypto');
const generate_jwt_token = require('../../../../utils/generate_jwt_token');
const logger = require('../../../../../config/winston');

// POST /api/move_in/landlord/auth/handoff
// Called by landlord_main with the landlord's existing JWT.
// Returns a short-lived one-time token that move_in can exchange for a Move-In JWT.
// Requires: authenticateJWT middleware (landlord_main JWT must be valid).
const handoff = async (request, reply) => {
    try {
        const decoded = request.user;

        // Only PayServe landlords can use this endpoint
        if (decoded.type !== 'Landlord') {
            return reply.code(403).send({ error: 'Only landlord accounts can use this endpoint.' });
        }

        const psUserId = decoded.userId;

        // Look up PayServe User to get email
        const psUser = await db.User.findById(psUserId).select('email fullName phoneNumber isEnabled').lean();
        if (!psUser || !psUser.isEnabled) {
            return reply.code(403).send({ error: 'Landlord account not found or inactive.' });
        }

        // Find or auto-provision MoveInLandlordUser
        let landlord = await db.moveIn.MoveInLandlordUser.findOne({ email: psUser.email });
        if (!landlord) {
            landlord = await db.moveIn.MoveInLandlordUser.create({
                fullName:       psUser.fullName || psUser.email,
                email:          psUser.email,
                phoneNumber:    psUser.phoneNumber || '0000000000',
                password:       'MANAGED_BY_PAYSERVE',
                isEnabled:      true,
                payserveUserId: psUserId,
            });
            logger.info(`[move_in/landlord] Auto-provisioned via handoff: ${psUser.email}`);
        } else if (!landlord.payserveUserId) {
            landlord.payserveUserId = psUserId;
            await landlord.save();
        }

        if (!landlord.isEnabled) {
            return reply.code(403).send({ error: 'Move-In landlord account is suspended.' });
        }

        // Generate a 64-byte random one-time token, valid for 90 seconds
        const token = crypto.randomBytes(64).toString('hex');
        const expiresAt = new Date(Date.now() + 90 * 1000);

        await db.moveIn.MoveInHandoffToken.create({
            token,
            landlordId: landlord._id,
            used: false,
            expiresAt,
        });

        logger.info(`[move_in/landlord] Handoff token issued for: ${psUser.email}`);
        return reply.code(200).send({ success: true, handoffToken: token });
    } catch (err) {
        logger.error('[move_in/landlord/handoff] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = handoff;
