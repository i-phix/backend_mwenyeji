const db = require('payservedb');
const mailer = require('../../../services/move_in_mailer');
const logger = require('../../../../config/winston');

// PUT /api/move_in/admin/landlords/:landlordId/verify
// Body: { action: 'enable' | 'disable' }
const verify_landlord = async (request, reply) => {
    try {
        const { landlordId } = request.params;
        const { action } = request.body || {};

        if (!['enable', 'disable'].includes(action)) {
            return reply.code(400).send({ error: 'action must be "enable" or "disable".' });
        }

        const landlord = await db.moveIn.MoveInLandlordUser.findById(landlordId);
        if (!landlord) return reply.code(404).send({ error: 'Landlord not found.' });

        landlord.isEnabled = action === 'enable';
        await landlord.save();

        if (action === 'enable') {
            try {
                await mailer.landlordVerified(landlord.email, landlord.fullName);
            } catch (e) {
                logger.warn('[move_in/admin/verify_landlord] email skipped: ' + e.message);
            }
        }

        logger.info(`[move_in/admin] Landlord ${landlordId} ${action}d by admin ${request.user?.userId}`);
        return reply.code(200).send({ success: true, message: `Landlord account ${action}d.` });
    } catch (err) {
        logger.error('[move_in/admin/verify_landlord] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = verify_landlord;
