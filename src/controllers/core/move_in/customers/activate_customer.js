const db = require('payservedb');
const logger = require('../../../../../config/winston');

// PUT /api/core/move_in/customers/activate/:customerId
const activate_customer = async (request, reply) => {
    try {
        const { customerId } = request.params;

        const user = await db.moveIn.MoveInUser.findByIdAndUpdate(
            customerId,
            { isEnabled: true },
            { new: true }
        );

        if (!user) return reply.code(404).send({ error: 'Customer not found.' });

        logger.info(`[core/move_in] Customer ${customerId} activated by ${request.user?.userId}`);
        return reply.code(200).send({ success: true, message: 'Customer activated.' });
    } catch (err) {
        logger.error('[core/move_in/customers/activate] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = activate_customer;
