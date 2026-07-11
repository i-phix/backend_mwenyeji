const db = require('payservedb');
const logger = require('../../../../../config/winston');

// GET /api/move_in/landlord/units
const get_units = async (request, reply) => {
    try {
        const { userId } = request.user;
        const units = await db.moveIn.MoveInUnit.find({ landlordId: userId }).sort({ createdAt: -1 }).lean();
        return reply.code(200).send({ success: true, data: units });
    } catch (err) {
        logger.error('[move_in/landlord/get_units] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_units;
