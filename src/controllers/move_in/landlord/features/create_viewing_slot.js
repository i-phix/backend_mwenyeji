const db = require('payservedb');
const logger = require('../../../../../config/winston');

// POST /api/move_in/landlord/viewings/slots
const create_viewing_slot = async (request, reply) => {
    try {
        const { userId } = request.user;
        const { unitId, unitName, date, time, durationMins, capacity } = request.body;

        if (!unitId || !date || !time) return reply.code(400).send({ error: 'unitId, date and time are required.' });

        // Verify this landlord owns the unit
        const unit = await db.moveIn.MoveInUnit.findOne({ _id: unitId, landlordId: userId }).lean();
        if (!unit) return reply.code(404).send({ error: 'Unit not found.' });

        const slot = await db.moveIn.MoveInViewingSlot.create({
            landlordId:  userId,
            unitId,
            unitName:    unitName || unit.title,
            date:        new Date(date),
            time,
            durationMins: durationMins || 30,
            capacity:    capacity || 1,
            bookedCount: 0,
            isAvailable: true,
        });

        return reply.code(201).send({ success: true, data: slot });
    } catch (err) {
        logger.error('[move_in/landlord/create_viewing_slot] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = create_viewing_slot;
