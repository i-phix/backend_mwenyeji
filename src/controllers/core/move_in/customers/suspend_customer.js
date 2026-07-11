const db = require('payservedb');
const logger = require('../../../../../config/winston');

// PUT /api/core/move_in/customers/suspend/:customerId
const suspend_customer = async (request, reply) => {
    try {
        const { customerId } = request.params;

        const user = await db.moveIn.MoveInUser.findByIdAndUpdate(
            customerId,
            { isEnabled: false },
            { new: true }
        );

        if (!user) return reply.code(404).send({ error: 'Customer not found.' });

        logger.info(`[core/move_in] Customer ${customerId} suspended by ${request.user?.userId}`);
        return reply.code(200).send({ success: true, message: 'Customer suspended.' });
    } catch (err) {
        logger.error('[core/move_in/customers/suspend] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = suspend_customer;
