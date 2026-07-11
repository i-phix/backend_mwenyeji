const db = require('payservedb');
const logger = require('../../../../config/winston');
const { notifyLandlord, notifyTenant } = require('../utils/notifications');

// PUT /api/move_in/viewing/bookings/cancel/:bookingId
const cancel_booking = async (request, reply) => {
    try {
        const { userId } = request.user;
        const { bookingId } = request.params;
        const { reason } = request.body || {};

        const booking = await db.moveIn.MoveInBooking.findOne({ _id: bookingId, tenantId: userId });
        if (!booking) return reply.code(404).send({ error: 'Booking not found.' });
        if (booking.status === 'cancelled') return reply.code(400).send({ error: 'Booking already cancelled.' });
        if (booking.status === 'completed') return reply.code(400).send({ error: 'Cannot cancel a completed booking.' });

        booking.status = 'cancelled';
        booking.cancelledAt = new Date();
        booking.cancelReason = reason || null;
        await booking.save();

        // Free the slot seat
        const slot = await db.moveIn.MoveInViewingSlot.findById(booking.slotId);
        if (slot && slot.bookedCount > 0) {
            slot.bookedCount -= 1;
            slot.isAvailable = true;
            await slot.save();
        }

        await db.moveIn.MoveInDeal.updateOne(
            { bookingId: booking._id },
            { $set: { status: 'cancelled', lastEvent: 'viewing_cancelled_by_tenant', cancelledReason: reason || 'Cancelled by tenant' } }
        );

        await notifyTenant({
            tenantId: userId,
            email: booking.tenantEmail,
            title: 'Viewing Cancelled',
            body: `Your viewing for ${booking.unitName || 'the unit'} has been cancelled.`,
            type: 'viewing',
            relatedId: booking._id,
            emailSubject: `Viewing cancelled for ${booking.unitName || 'the unit'}`,
            emailText: `Hi ${booking.tenantName || 'there'},\n\nYour viewing for ${booking.unitName || 'the unit'} has been cancelled.${reason ? `\n\nReason: ${reason}` : ''}\n\nMove-In by PayServe`,
            facilityId: booking.facilityId,
        });

        await notifyLandlord({
            landlordId: booking.landlordId,
            title: 'Viewing Cancelled',
            body: `${booking.tenantName || 'A tenant'} cancelled a viewing for ${booking.unitName || 'a unit'}.`,
            type: 'viewing',
            relatedId: booking._id,
            emailSubject: `Viewing cancelled for ${booking.unitName || 'your unit'}`,
            emailText: `${booking.tenantName || 'A tenant'} cancelled a viewing for ${booking.unitName || 'your unit'}.${reason ? `\n\nReason: ${reason}` : ''}\n\nMove-In by PayServe`,
            facilityId: booking.facilityId,
        });

        logger.info(`[move_in] Viewing booking ${bookingId} cancelled by tenant ${userId}`);
        return reply.code(200).send({ success: true, message: 'Booking cancelled.' });
    } catch (err) {
        logger.error('[move_in/viewing/cancel] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = cancel_booking;
