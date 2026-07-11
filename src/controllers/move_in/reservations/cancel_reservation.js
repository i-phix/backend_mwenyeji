const db = require('payservedb');
const logger = require('../../../../config/winston');
const { setStandaloneUnitStatus } = require('../utils/lifecycle');
const { notifyLandlord, notifyTenant } = require('../utils/notifications');

// PUT /api/move_in/reservations/cancel/:reservationId
const cancel_reservation = async (request, reply) => {
    try {
        const { userId } = request.user;
        const { reservationId } = request.params;

        const reservation = await db.moveIn.MoveInReservation.findOne({ _id: reservationId, tenantId: userId });
        if (!reservation) return reply.code(404).send({ error: 'Reservation not found.' });
        if (reservation.status === 'cancelled') return reply.code(400).send({ error: 'Already cancelled.' });

        reservation.status = 'cancelled';
        await reservation.save();

        await db.moveIn.MoveInDeal.updateOne(
            { reservationId: reservation._id },
            { $set: { status: 'cancelled', lastEvent: 'reservation_cancelled_by_tenant', cancelledReason: 'Cancelled by tenant' } }
        );
        await setStandaloneUnitStatus(reservation.unitId, 'listed', null);

        await notifyTenant({
            tenantId: userId,
            email: reservation.tenantEmail,
            title: 'Reservation Cancelled',
            body: `Your reservation for ${reservation.unitName || 'the unit'} has been cancelled.`,
            type: 'reservation',
            relatedId: reservation._id,
            emailSubject: `Reservation cancelled for ${reservation.unitName || 'the unit'}`,
            emailText: `Hi ${reservation.tenantName || 'there'},\n\nYour reservation for ${reservation.unitName || 'the unit'} has been cancelled.\n\nMove-In by PayServe`,
            facilityId: reservation.facilityId,
        });

        await notifyLandlord({
            landlordId: reservation.landlordId,
            title: 'Reservation Cancelled',
            body: `${reservation.tenantName || 'A tenant'} cancelled a reservation for ${reservation.unitName || 'a unit'}.`,
            type: 'reservation',
            relatedId: reservation._id,
            emailSubject: `Reservation cancelled for ${reservation.unitName || 'your unit'}`,
            emailText: `${reservation.tenantName || 'A tenant'} cancelled a reservation for ${reservation.unitName || 'your unit'}.\n\nMove-In by PayServe`,
            facilityId: reservation.facilityId,
        });

        logger.info(`[move_in] Reservation ${reservationId} cancelled by tenant ${userId}`);
        return reply.code(200).send({ success: true, message: 'Reservation cancelled.' });
    } catch (err) {
        logger.error('[move_in/reservations/cancel] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = cancel_reservation;
