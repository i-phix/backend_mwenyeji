const db = require('payservedb');
const logger = require('../../../../../config/winston');

// DELETE /api/move_in/landlord/viewings/slots/:slotId
const cancel_viewing_slot = async (request, reply) => {
    try {
        const { userId } = request.user;
        const { slotId } = request.params;

        const slot = await db.moveIn.MoveInViewingSlot.findOne({ _id: slotId, landlordId: userId });
        if (!slot) return reply.code(404).send({ error: 'Slot not found or not yours.' });
        if (slot.bookedCount > 0) return reply.code(400).send({ error: 'Cannot cancel a slot that already has bookings.' });

        await db.moveIn.MoveInViewingSlot.deleteOne({ _id: slotId });
        return reply.code(200).send({ success: true, message: 'Viewing slot cancelled.' });
    } catch (err) {
        logger.error('[move_in/landlord/cancel_viewing_slot] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = cancel_viewing_slot;
