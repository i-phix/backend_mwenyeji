const db = require('payservedb');
const logger = require('../../../../config/winston');
const { clean, normalizeEmail, resolveMoveInUnit, upsertDeal } = require('../utils/lifecycle');
const { notifyLandlord, notifyTenant } = require('../utils/notifications');

// POST /api/move_in/reservations
const create_reservation = async (request, reply) => {
    try {
        const userId = request.user?.userId || null;
        const {
            unitId,
            facilityId,
            desiredMoveInDate,
            monthsToStay,
            fullName,
            email,
            phoneNumber,
        } = request.body;
        if (!unitId) return reply.code(400).send({ error: 'unitId is required.' });

        const guestEmail = normalizeEmail(email);
        const guestName = clean(fullName);
        const guestPhone = clean(phoneNumber);
        const isGuest = !userId;

        if (isGuest && (!guestName || !guestEmail || !guestPhone)) {
            return reply.code(400).send({ error: 'fullName, email and phoneNumber are required.' });
        }

        const duplicateFilter = {
            unitId,
            status: { $in: ['pending', 'confirmed'] },
            ...(userId ? { tenantId: userId } : { tenantEmail: guestEmail, isGuest: true }),
        };

        // Prevent duplicate active reservations for same unit
        const existing = await db.moveIn.MoveInReservation.findOne(duplicateFilter);
        if (existing) return reply.code(409).send({ error: 'You already have an active reservation for this unit.' });

        const [tenant, resolved] = await Promise.all([
            userId ? db.moveIn.MoveInUser.findById(userId).lean() : null,
            resolveMoveInUnit({ unitId, facilityId, requireListed: true }),
        ]);

        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours to confirm

        const reservation = await db.moveIn.MoveInReservation.create({
            tenantId: userId,
            tenantName: tenant?.fullName || guestName,
            tenantEmail: tenant?.email || guestEmail,
            tenantPhone: tenant?.phoneNumber || guestPhone,
            isGuest,
            unitId,
            unitName: resolved.unitName,
            facilityId: resolved.facilityId,
            landlordId: resolved.landlordId,
            desiredMoveInDate: desiredMoveInDate ? new Date(desiredMoveInDate) : null,
            monthsToStay: monthsToStay || null,
            status: 'pending',
            expiresAt,
        });

        const deal = await upsertDeal({
            resolved,
            tenant,
            guest: { fullName: guestName, email: guestEmail, phoneNumber: guestPhone },
            status: 'lead',
            event: 'reservation_created',
            reservationId: reservation._id,
            desiredMoveInDate: reservation.desiredMoveInDate,
            notes: monthsToStay ? `Months to stay: ${monthsToStay}` : null,
        });

        const unitPrice = Number(resolved.price || 0);
        const reservationFee = unitPrice > 0 ? Math.round(unitPrice * 0.1) : 0;
        if (userId && reservationFee > 0) {
            await db.moveIn.MoveInPayment.create({
                tenantId: userId,
                tenantName: tenant?.fullName,
                unitId,
                unitName: resolved.unitName,
                reservationId: reservation._id,
                dealId: deal._id,
                type: 'reservation_fee',
                amount: reservationFee,
                currency: 'KES',
                status: 'pending',
                notes: 'Automatically generated when the tenant reserved the unit.',
            });
        }

        await db.moveIn.MoveInAuditLog.create({
            action: 'reservation_created',
            resourceType: 'reservation',
            resourceId: reservation._id,
            details: `${isGuest ? 'Guest' : 'Tenant'} ${tenant?.fullName || guestName || userId} reserved ${resolved.unitName || unitId}.`,
            ipAddress: request.ip || null,
        });

        await notifyTenant({
            tenantId: userId,
            email: tenant?.email || guestEmail,
            title: 'Reservation Submitted',
            body: `Your reservation for ${resolved.unitName || 'the unit'} has been submitted. You'll hear back within 48 hours.`,
            type: 'reservation',
            relatedId: reservation._id,
            emailSubject: `Reservation received for ${resolved.unitName || 'the unit'}`,
            emailText: `Hi ${tenant?.fullName || guestName || 'there'},\n\nYour reservation for ${resolved.unitName || 'the unit'} has been submitted. The landlord will contact you with next steps.\n\nMove-In by PayServe`,
            facilityId: resolved.facilityId,
        });

        await notifyLandlord({
            landlordId: resolved.landlordId,
            title: 'New Reservation',
            body: `${tenant?.fullName || guestName || 'A prospect'} reserved ${resolved.unitName || 'a unit'}.`,
            type: 'reservation',
            relatedId: reservation._id,
            emailSubject: `New reservation for ${resolved.unitName || 'your unit'}`,
            emailText: `${tenant?.fullName || guestName || 'A prospect'} reserved ${resolved.unitName || 'your unit'}.\n\nEmail: ${tenant?.email || guestEmail || 'N/A'}\nPhone: ${tenant?.phoneNumber || guestPhone || 'N/A'}\n\nMove-In by PayServe`,
            facilityId: resolved.facilityId,
        });

        logger.info(`[move_in] Reservation created: ${isGuest ? `guest ${guestEmail}` : `tenant ${userId}`}, unit ${unitId}`);
        return reply.code(200).send({
            success: true,
            message: isGuest ? 'Reservation request submitted. Our team will contact you shortly.' : 'Reservation submitted.',
            data: { reservationId: reservation._id },
        });
    } catch (err) {
        logger.error('[move_in/reservations/create] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = create_reservation;
