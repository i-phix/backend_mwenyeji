const db = require('payservedb');
const { sendEmail } = require('../../../../utils/send_new_email');
const logger = require('../../../../../config/winston');
const { resolveMoveInUnit, upsertDeal, setStandaloneUnitStatus, ensureCommissionDue } = require('../../utils/lifecycle');
const { notifyTenant } = require('../../utils/notifications');
const { convertDealToPayServeRental } = require('../../utils/payserve_conversion');

const clean = (value) => String(value || '').trim();

const emailTenant = async (reservation, subject, body) => {
    if (!reservation.tenantEmail) return;
    await sendEmail(
        reservation.facilityId || null,
        reservation.tenantEmail,
        subject,
        body,
        null,
        'Move-In by PayServe'
    ).catch((err) => logger.error('[move_in/landlord/reservation_email] ' + err.message));
};

const inAppTenant = async (reservation, title, body) => notifyTenant({
    tenantId: reservation.tenantId,
    email: null,
    title,
    body,
    type: 'reservation',
    relatedId: reservation._id,
});

// PUT /api/move_in/landlord/reservations/:reservationId
// action: accept | reschedule | email | cancel | rent
const respond_reservation = async (request, reply) => {
    try {
        const { userId } = request.user;
        const { reservationId } = request.params;
        const { action, desiredMoveInDate, message } = request.body || {};

        if (!['accept', 'reschedule', 'email', 'cancel', 'rent'].includes(action)) {
            return reply.code(400).send({ error: "action must be 'accept', 'reschedule', 'email', 'cancel' or 'rent'." });
        }

        const reservation = await db.moveIn.MoveInReservation.findOne({ _id: reservationId, landlordId: userId });
        if (!reservation) return reply.code(404).send({ error: 'Reservation not found.' });

        const tenantName = reservation.tenantName || 'there';
        const unitName = reservation.unitName || 'the unit';
        const note = clean(message);
        const resolved = await resolveMoveInUnit({ unitId: reservation.unitId, facilityId: reservation.facilityId, requireListed: false });

        if (action === 'accept') {
            reservation.status = 'confirmed';
            reservation.landlordNote = note || reservation.landlordNote;
            await reservation.save();
            await emailTenant(
                reservation,
                `Reservation confirmed for ${unitName}`,
                `Hi ${tenantName},\n\nYour reservation for ${unitName} has been confirmed.${note ? `\n\nNote: ${note}` : ''}\n\nMove-In by PayServe`
            );
            await inAppTenant(reservation, 'Reservation Confirmed', `Your reservation for ${unitName} has been confirmed.`);

            const deal = await upsertDeal({
                resolved,
                tenant: reservation.tenantId ? { _id: reservation.tenantId, fullName: reservation.tenantName, email: reservation.tenantEmail, phoneNumber: reservation.tenantPhone } : null,
                guest: { fullName: reservation.tenantName, email: reservation.tenantEmail, phoneNumber: reservation.tenantPhone },
                status: 'offer_sent',
                event: 'reservation_accepted',
                reservationId: reservation._id,
                desiredMoveInDate: reservation.desiredMoveInDate,
                notes: note || null,
            });
        }

        if (action === 'reschedule') {
            if (!desiredMoveInDate) return reply.code(400).send({ error: 'desiredMoveInDate is required for reschedule.' });
            reservation.status = 'pending';
            reservation.desiredMoveInDate = new Date(desiredMoveInDate);
            reservation.landlordNote = note || reservation.landlordNote;
            await reservation.save();
            await emailTenant(
                reservation,
                `Reservation date proposed for ${unitName}`,
                `Hi ${tenantName},\n\nThe landlord proposed a new move-in date for ${unitName}: ${new Date(reservation.desiredMoveInDate).toDateString()}.${note ? `\n\nNote: ${note}` : ''}\n\nMove-In by PayServe`
            );
            await inAppTenant(reservation, 'Reservation Date Proposed', `The landlord proposed a new move-in date for ${unitName}: ${new Date(reservation.desiredMoveInDate).toDateString()}.`);

            await upsertDeal({
                resolved,
                tenant: reservation.tenantId ? { _id: reservation.tenantId, fullName: reservation.tenantName, email: reservation.tenantEmail, phoneNumber: reservation.tenantPhone } : null,
                guest: { fullName: reservation.tenantName, email: reservation.tenantEmail, phoneNumber: reservation.tenantPhone },
                status: 'reserved',
                event: 'reservation_rescheduled',
                reservationId: reservation._id,
                desiredMoveInDate: reservation.desiredMoveInDate,
                notes: note || null,
            });
        }

        if (action === 'email') {
            if (!note) return reply.code(400).send({ error: 'message is required.' });
            reservation.landlordNote = note;
            await reservation.save();
            await emailTenant(reservation, `Message about your reservation for ${unitName}`, `Hi ${tenantName},\n\n${note}\n\nMove-In by PayServe`);
            await inAppTenant(reservation, 'Reservation Message', `The landlord sent a message about your reservation for ${unitName}.`);
        }

        if (action === 'cancel') {
            reservation.status = 'cancelled';
            reservation.landlordNote = note || reservation.landlordNote;
            await reservation.save();
            await emailTenant(
                reservation,
                `Reservation cancelled for ${unitName}`,
                `Hi ${tenantName},\n\nYour reservation for ${unitName} has been cancelled.${note ? `\n\nReason: ${note}` : ''}\n\nMove-In by PayServe`
            );
            await inAppTenant(reservation, 'Reservation Cancelled', `Your reservation for ${unitName} has been cancelled.${note ? ` Reason: ${note}` : ''}`);
            const deal = await upsertDeal({
                resolved,
                tenant: reservation.tenantId ? { _id: reservation.tenantId, fullName: reservation.tenantName, email: reservation.tenantEmail, phoneNumber: reservation.tenantPhone } : null,
                guest: { fullName: reservation.tenantName, email: reservation.tenantEmail, phoneNumber: reservation.tenantPhone },
                status: 'cancelled',
                event: 'reservation_cancelled',
                reservationId: reservation._id,
                desiredMoveInDate: reservation.desiredMoveInDate,
                notes: note || null,
            });
            if (resolved.source === 'standalone') await setStandaloneUnitStatus(resolved.unitId, 'listed', null);
        }

        let deal = null;
        let commission = null;
        let conversion = null;
        if (action === 'rent') {
            if (!['confirmed'].includes(reservation.status)) {
                return reply.code(400).send({ error: 'Only confirmed reservations can be marked as rented.' });
            }
            deal = await upsertDeal({
                resolved,
                tenant: reservation.tenantId ? { _id: reservation.tenantId, fullName: reservation.tenantName, email: reservation.tenantEmail, phoneNumber: reservation.tenantPhone } : null,
                guest: { fullName: reservation.tenantName, email: reservation.tenantEmail, phoneNumber: reservation.tenantPhone },
                status: 'rented',
                event: 'reservation_marked_rented',
                reservationId: reservation._id,
                desiredMoveInDate: reservation.desiredMoveInDate,
                notes: note || null,
            });
            if (resolved.source === 'payserve') {
                conversion = await convertDealToPayServeRental({
                    dealId: deal._id,
                    actorId: request.user?.payserveUserId || userId,
                    body: request.body || {},
                });
                commission = conversion.commission || null;
            } else {
                commission = await ensureCommissionDue(deal, {
                    baseAmount: resolved.price,
                    notes: `Commission generated from reservation ${reservation._id}.`,
                });
                await setStandaloneUnitStatus(resolved.unitId, 'rented', deal._id);
            }
            await emailTenant(reservation, `Rental confirmed for ${unitName}`, `Hi ${tenantName},\n\nYour rental for ${unitName} has been confirmed.${note ? `\n\nNote: ${note}` : ''}\n\nMove-In by PayServe`);
            await inAppTenant(reservation, 'Rental Confirmed', `Your rental for ${unitName} has been confirmed.`);
        }

        return reply.code(200).send({ success: true, message: 'Reservation updated.', data: { reservation, dealId: deal?._id || null, commissionId: commission?._id || null, conversion } });
    } catch (err) {
        logger.error('[move_in/landlord/respond_reservation] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = respond_reservation;
