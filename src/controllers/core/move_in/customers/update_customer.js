const db = require('payservedb');
const logger = require('../../../../../config/winston');

// PUT /api/core/move_in/customers/:customerId
const update_customer = async (request, reply) => {
    try {
        const { customerId } = request.params;
        const { fullName, email, phoneNumber, isEnabled } = request.body || {};

        const update = {};
        if (fullName !== undefined) update.fullName = String(fullName).trim();
        if (email !== undefined) update.email = String(email).trim().toLowerCase();
        if (phoneNumber !== undefined) update.phoneNumber = String(phoneNumber).trim();
        if (isEnabled !== undefined) update.isEnabled = Boolean(isEnabled);

        const user = await db.moveIn.MoveInUser.findByIdAndUpdate(
            customerId,
            { $set: update },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) return reply.code(404).send({ error: 'Customer not found.' });

        logger.info(`[core/move_in] Customer ${customerId} updated by ${request.user?.userId}`);
        return reply.code(200).send({ success: true, data: user });
    } catch (err) {
        logger.error('[core/move_in/customers/update] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = update_customer;
