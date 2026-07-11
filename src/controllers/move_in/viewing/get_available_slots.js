const db = require('payservedb');
const logger = require('../../../../config/winston');

// GET /api/move_in/viewing/available
// Returns all upcoming available slots (with unit info) grouped so tenants can browse
const get_available_slots = async (request, reply) => {
    try {
        const { unitId, city } = request.query;

        const filter = { isAvailable: true, date: { $gte: new Date() } };
        if (unitId) filter.unitId = unitId;

        const slots = await db.moveIn.MoveInViewingSlot.find(filter)
            .sort({ date: 1, time: 1 })
            .lean();

        // Annotate with available seats
        const result = slots.map((s) => ({
            ...s,
            availableSeats: s.capacity - s.bookedCount,
        }));

        // Group by unit for easier frontend consumption
        const byUnit = {};
        for (const slot of result) {
            const key = String(slot.unitId);
            if (!byUnit[key]) {
                byUnit[key] = {
                    unitId: slot.unitId,
                    unitName: slot.unitName,
                    landlordId: slot.landlordId,
                    slots: [],
                };
            }
            byUnit[key].slots.push(slot);
        }

        return reply.code(200).send({ success: true, data: Object.values(byUnit) });
    } catch (err) {
        logger.error('[move_in/viewing/get_available_slots] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_available_slots;
