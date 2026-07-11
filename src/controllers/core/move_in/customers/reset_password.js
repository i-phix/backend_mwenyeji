const bcrypt = require('bcryptjs');
const db = require('payservedb');
const logger = require('../../../../../config/winston');

const makePassword = () => `MoveIn-${Math.random().toString(36).slice(2, 8)}${Math.floor(100 + Math.random() * 900)}!`;

// PUT /api/core/move_in/customers/reset_password/:customerId
const reset_password = async (request, reply) => {
    try {
        const { customerId } = request.params;
        const tempPassword = makePassword();
        const password = await bcrypt.hash(tempPassword, 10);

        const user = await db.moveIn.MoveInUser.findByIdAndUpdate(
            customerId,
            { password },
            { new: true }
        ).select('fullName email phoneNumber');

        if (!user) return reply.code(404).send({ error: 'Customer not found.' });

        logger.info(`[core/move_in] Customer ${customerId} password reset by ${request.user?.userId}`);
        return reply.code(200).send({ success: true, message: 'Password reset.', data: { tempPassword, user } });
    } catch (err) {
        logger.error('[core/move_in/customers/reset_password] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = reset_password;
