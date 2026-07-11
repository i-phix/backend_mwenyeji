const db = require('payservedb');
const logger = require('../../../../config/winston');
const { ensureMoveInLandlordForPayServeUser, landlordRecordFilter, sendError } = require('./context');

// DELETE /api/landlord/move_in/viewing/slots/:slotId
const cancel_slot = async (request, reply) => {
    try {
        const { userId } = request.user;
        const { slotId } = request.params;

        const { moveInLandlord } = await ensureMoveInLandlordForPayServeUser(userId);
        const slot = await db.moveIn.MoveInViewingSlot.findOne({
            _id: slotId,
            ...landlordRecordFilter({ payserveUserId: userId, moveInLandlordId: moveInLandlord._id }),
        });
        if (!slot) return reply.code(404).send({ error: 'Slot not found.' });

        slot.isAvailable = false;
        await slot.save();

        // Cancel pending bookings for this slot
        await db.moveIn.MoveInBooking.updateMany(
            { slotId, status: { $in: ['pending', 'confirmed'] } },
            { status: 'cancelled', cancelReason: 'Slot cancelled by landlord', cancelledAt: new Date() }
        );

        logger.info(`[landlord/move_in] Slot ${slotId} cancelled by landlord ${userId}`);
        return reply.code(200).send({ success: true, message: 'Slot cancelled.' });
    } catch (err) {
        logger.error('[landlord/move_in/cancel_slot] ' + err.message);
        return sendError(reply, err);
    }
};

module.exports = cancel_slot;
