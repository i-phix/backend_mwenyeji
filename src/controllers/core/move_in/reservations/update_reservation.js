const db = require('payservedb');
const logger = require('../../../../../config/winston');

// PUT /api/core/move_in/reservations/:reservationId
const update_reservation = async (request, reply) => {
    try {
        const { userId: adminId } = request.user;
        const { reservationId } = request.params;
        const { status, adminNote } = request.body;

        const reservation = await db.moveIn.MoveInReservation.findById(reservationId);
        if (!reservation) return reply.code(404).send({ error: 'Reservation not found.' });

        if (status) reservation.status = status;
        if (adminNote !== undefined) reservation.adminNote = adminNote;
        await reservation.save();

        // Notify tenant
        const statusMsg = { confirmed: 'confirmed', expired: 'expired', cancelled: 'cancelled' };
        if (statusMsg[status]) {
            await db.moveIn.MoveInNotification.create({
                recipientId: reservation.tenantId,
                recipientType: 'tenant',
                title: `Reservation ${statusMsg[status]}`,
                body: `Your reservation for ${reservation.unitName || 'the unit'} has been ${statusMsg[status]}.${adminNote ? ` Note: ${adminNote}` : ''}`,
                type: 'reservation',
                relatedId: reservation._id,
            }).catch(() => {});
        }

        // Log audit
        await db.moveIn.MoveInAuditLog.create({
            adminId,
            action: `reservation_${status || 'updated'}`,
            resourceType: 'reservation',
            resourceId: reservation._id,
            details: adminNote || null,
            ipAddress: request.ip || null,
        }).catch(() => {});

        logger.info(`[core/move_in] Reservation ${reservationId} updated to ${status} by ${adminId}`);
        return reply.code(200).send({ success: true, message: 'Reservation updated.' });
    } catch (err) {
        logger.error('[core/move_in/reservations/update] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = update_reservation;
