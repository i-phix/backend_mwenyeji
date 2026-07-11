const db = require('payservedb');
const mailer = require('../../../services/move_in_mailer');
const logger = require('../../../../config/winston');

// PUT /api/move_in/admin/reservations/:reservationId/complete
// Confirms the reservation and promotes the MoveInUser to a Resident in payserve_property.
// Body: { facilityId, unitId, unitName, nationalId? }
const complete_onboarding = async (request, reply) => {
    try {
        const { reservationId } = request.params;
        const { facilityId, unitId, unitName, nationalId } = request.body || {};

        if (!facilityId || !unitId) {
            return reply.code(400).send({ error: 'facilityId and unitId are required.' });
        }

        const reservation = await db.moveIn.MoveInReservation.findById(reservationId);
        if (!reservation) return reply.code(404).send({ error: 'Reservation not found.' });
        if (reservation.status === 'cancelled' || reservation.status === 'expired') {
            return reply.code(409).send({ error: `Cannot complete a ${reservation.status} reservation.` });
        }

        const tenant = await db.moveIn.MoveInUser.findById(reservation.tenantId).lean();
        if (!tenant) return reply.code(404).send({ error: 'Tenant not found.' });

        // Generate a sequential residentId  (format: RES-<timestamp>)
        const residentId = `RES-${Date.now()}`;

        // Create Resident record in payserve_property
        try {
            await db.Resident.create({
                residentId,
                name:       tenant.fullName,
                email:      tenant.email,
                phone:      tenant.phoneNumber || '0000000000',
                nationalId: nationalId || `MOVEIN-${tenant._id}`,
                unitId,
                unitName:   unitName || reservation.unitName || 'Unit',
                facilityId,
                contracts:  [],
                levies:     [],
                invoices:   [],
                paymentHistory: [],
                isActive:   true,
            });
            logger.info(`[move_in/admin] Resident created: ${residentId} for tenant ${tenant._id}`);
        } catch (e) {
            logger.error('[move_in/admin/complete_onboarding] Resident creation failed: ' + e.message);
            return reply.code(502).send({ error: 'Failed to create Resident record: ' + e.message });
        }

        // Mark reservation confirmed
        reservation.status = 'confirmed';
        await reservation.save();

        await db.moveIn.MoveInDeal.updateOne(
            { reservationId: reservation._id },
            {
                $set: {
                    status: 'tenant_confirmed',
                    lastEvent: 'admin_onboarding_completed',
                    'payserveSync.status': 'synced',
                    'payserveSync.residentId': null,
                    'payserveSync.syncedAt': new Date(),
                },
            }
        ).catch((e) => logger.warn('[move_in/admin/complete_onboarding] deal sync skipped: ' + e.message));

        // In-app notification
        await db.moveIn.MoveInNotification.create({
            recipientId:   tenant._id,
            recipientType: 'tenant',
            title: 'Move-In Confirmed!',
            body:  `Congratulations! Your move-in${unitName ? ' to ' + unitName : ''} has been confirmed. Welcome to your new home.`,
            type:  'reservation',
            relatedId: reservation._id,
        });

        // Email
        try {
            await mailer.reservationConfirmed(tenant.email, unitName || 'the unit', reservation.desiredMoveInDate);
        } catch (e) {
            logger.warn('[move_in/admin/complete_onboarding] email skipped: ' + e.message);
        }

        return reply.code(200).send({
            success: true,
            message: 'Move-In onboarding complete. Resident record created.',
            data: { residentId, reservationId },
        });
    } catch (err) {
        logger.error('[move_in/admin/complete_onboarding] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = complete_onboarding;
