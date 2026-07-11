const db = require('payservedb');
const logger = require('../../../../config/winston');

// GET /api/move_in/viewing/slots?unitId=&date=
const get_slots = async (request, reply) => {
    try {
        const { unitId, date } = request.query;
        if (!unitId) return reply.code(400).send({ error: 'unitId is required.' });

        const filter = { unitId, isAvailable: true };
        if (date) {
            const d = new Date(date);
            const next = new Date(d);
            next.setDate(next.getDate() + 1);
            filter.date = { $gte: d, $lt: next };
        } else {
            filter.date = { $gte: new Date() };
        }

        const slots = await db.moveIn.MoveInViewingSlot.find(filter).sort({ date: 1, time: 1 }).lean();

        // Annotate with available seats
        const result = slots.map((s) => ({
            ...s,
            availableSeats: s.capacity - s.bookedCount,
        }));

        return reply.code(200).send({ success: true, data: result });
    } catch (err) {
        logger.error('[move_in/viewing/get_slots] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_slots;
