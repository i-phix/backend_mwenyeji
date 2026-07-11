const db = require('payservedb');
const logger = require('../../../../../config/winston');

// PUT /api/core/move_in/landlords/revoke/:landlordId
// Revokes Move-In module access from a landlord. Does not delete the record.
const revoke_module = async (request, reply) => {
    try {
        const { landlordId } = request.params;

        const record = await db.moveIn.MoveInLandlord.findOne({ landlordId });
        if (!record) {
            return reply.code(404).send({ error: 'Landlord does not have Move-In module access.' });
        }
        if (!record.isEnabled) {
            return reply.code(409).send({ error: 'Move-In module access is already revoked.' });
        }

        record.isEnabled = false;
        record.revokedAt = new Date();
        await record.save();

        logger.info(`[core/move_in] Module revoked for landlord ${landlordId}`);
        return reply.code(200).send({ success: true, message: 'Move-In module access revoked.' });
    } catch (err) {
        logger.error('[core/move_in/landlords/revoke] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = revoke_module;
