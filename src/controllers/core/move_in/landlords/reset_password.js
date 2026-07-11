const bcrypt = require('bcryptjs');
const db = require('payservedb');
const logger = require('../../../../../config/winston');

const makePassword = () => `MoveIn-${Math.random().toString(36).slice(2, 8)}${Math.floor(100 + Math.random() * 900)}!`;

// PUT /api/core/move_in/landlords/reset_password/:landlordId
const reset_password = async (request, reply) => {
    try {
        const { landlordId } = request.params;
        const record = await db.moveIn.MoveInLandlord.findOne({ landlordId }).lean();
        if (!record) return reply.code(404).send({ error: 'Landlord does not have Move-In access.' });

        const tempPassword = makePassword();
        const password = await bcrypt.hash(tempPassword, 10);

        const user = await db.User.findByIdAndUpdate(
            landlordId,
            { password },
            { new: true }
        ).select('fullName email phoneNumber');

        if (!user) return reply.code(404).send({ error: 'Landlord user not found.' });

        logger.info(`[core/move_in] Landlord ${landlordId} password reset by ${request.user?.userId}`);
        return reply.code(200).send({ success: true, message: 'Password reset.', data: { tempPassword, user } });
    } catch (err) {
        logger.error('[core/move_in/landlords/reset_password] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = reset_password;
