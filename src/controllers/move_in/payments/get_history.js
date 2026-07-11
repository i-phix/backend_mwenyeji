const db = require('payservedb');
const logger = require('../../../../config/winston');

// GET /api/move_in/payments
const get_history = async (request, reply) => {
    try {
        const { userId } = request.user;

        const payments = await db.moveIn.MoveInPayment.find({ tenantId: userId }).sort({ createdAt: -1 }).lean();
        return reply.code(200).send({ success: true, data: payments });
    } catch (err) {
        logger.error('[move_in/payments/get_history] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_history;
