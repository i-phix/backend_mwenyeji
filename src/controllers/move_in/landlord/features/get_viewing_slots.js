const db = require('payservedb');
const logger = require('../../../../../config/winston');

// GET /api/move_in/landlord/viewings/slots
const get_viewing_slots = async (request, reply) => {
    try {
        const { userId } = request.user;
        const slots = await db.moveIn.MoveInViewingSlot.find({ landlordId: userId }).sort({ date: 1, time: 1 }).lean();
        return reply.code(200).send({ success: true, data: slots });
    } catch (err) {
        logger.error('[move_in/landlord/get_viewing_slots] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_viewing_slots;
