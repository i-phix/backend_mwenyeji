const db = require('payservedb');
const logger = require('../../../../../config/winston');

// PUT /api/core/move_in/landlords/:landlordId
const update_landlord = async (request, reply) => {
    try {
        const { landlordId } = request.params;
        const { fullName, email, phoneNumber, isEnabled } = request.body || {};

        const record = await db.moveIn.MoveInLandlord.findOne({ landlordId });
        if (!record) return reply.code(404).send({ error: 'Landlord does not have Move-In access.' });

        const update = {};
        if (fullName !== undefined) update.fullName = String(fullName).trim();
        if (email !== undefined) update.email = String(email).trim().toLowerCase();
        if (phoneNumber !== undefined) update.phoneNumber = String(phoneNumber).trim();
        if (isEnabled !== undefined) record.isEnabled = Boolean(isEnabled);

        const [user] = await Promise.all([
            Object.keys(update).length
                ? db.User.findByIdAndUpdate(landlordId, { $set: update }, { new: true, runValidators: true }).select('-password')
                : db.User.findById(landlordId).select('-password'),
            record.save(),
        ]);

        if (!user) return reply.code(404).send({ error: 'Landlord user not found.' });

        logger.info(`[core/move_in] Landlord ${landlordId} updated by ${request.user?.userId}`);
        return reply.code(200).send({ success: true, data: user });
    } catch (err) {
        logger.error('[core/move_in/landlords/update] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = update_landlord;
