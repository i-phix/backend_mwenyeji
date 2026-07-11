const db = require('payservedb');
const logger = require('../../../../config/winston');
const { clean, normalizeEmail, resolveMoveInUnit, upsertDeal } = require('../utils/lifecycle');
const { notifyLandlord, notifyTenant } = require('../utils/notifications');

// POST /api/move_in/viewing/book
const book_slot = async (request, reply) => {
    try {
        const userId = request.user?.userId || null;
        const {
            slotId,
            unitId,
            facilityId,
            scheduledDate,
            scheduledTime,
            tenantNote,
            fullName,
            email,
            phoneNumber,
        } = request.body;
        if (!slotId && (!unitId || !scheduledDate || !scheduledTime)) {
            return reply.code(400).send({ error: 'slotId or unitId, scheduledDate and scheduledTime are required.' });
        }

        const guestEmail = normalizeEmail(email);
        const guestName = clean(fullName);
        const guestPhone = clean(phoneNumber);
        const isGuest = !userId;

        if (isGuest && (!guestName || !guestEmail || !guestPhone)) {
            return reply.code(400).send({ error: 'fullName, email and phoneNumber are required.' });
        }

        const slot = slotId ? await db.moveIn.MoveInViewingSlot.findById(slotId) : null;
        if (slotId && !slot) return reply.code(404).send({ error: 'Slot not found.' });
        if (slot) {
            if (!slot.isAvailable) return reply.code(400).send({ error: 'This slot is no longer available.' });
            if (slot.bookedCount >= slot.capacity) return reply.code(400).send({ error: 'This slot is fully booked.' });
        }

        // Check if tenant or guest already booked this slot
        const existing = await db.moveIn.MoveInBooking.findOne({
            ...(slotId ? { slotId } : { unitId, scheduledDate: new Date(scheduledDate), scheduledTime }),
            status: { $in: ['pending', 'confirmed'] },
            ...(userId ? { tenantId: userId } : { tenantEmail: guestEmail, isGuest: true }),
        });
        if (existing) return reply.code(409).send({ error: 'You already have a booking for this slot.' });

        const resolved = slot
            ? await resolveMoveInUnit({ unitId: slot.unitId, facilityId: slot.facilityId, requireListed: true })
            : await resolveMoveInUnit({ unitId, facilityId, requireListed: true });

        const [tenant] = await Promise.all([
            userId ? db.moveIn.MoveInUser.findById(userId).lean() : null,
        ]);
        const bookingDate = slot ? slot.date : new Date(scheduledDate);
        const bookingTime = slot ? slot.time : scheduledTime;
        const resolvedUnitId = resolved.unitId;
        const resolvedUnitName = resolved.unitName;
        const resolvedFacilityId = resolved.facilityId;
        const resolvedLandlordId = resolved.landlordId;

        const booking = await db.moveIn.MoveInBooking.create({
            slotId: slotId || null,
            tenantId: userId,
            tenantName: tenant?.fullName || guestName,
            tenantEmail: tenant?.email || guestEmail,
            tenantPhone: tenant?.phoneNumber || guestPhone,
            isGuest,
            unitId: resolvedUnitId,
            unitName: resolvedUnitName,
            facilityId: resolvedFacilityId,
            landlordId: resolvedLandlordId,
            scheduledDate: bookingDate,
            scheduledTime: bookingTime,
            tenantNote: tenantNote || null,
            status: slot ? 'confirmed' : 'pending',
        });

        if (slot) {
            slot.bookedCount += 1;
            if (slot.bookedCount >= slot.capacity) slot.isAvailable = false;
            await slot.save();
        }

        await upsertDeal({
            resolved,
            tenant,
            guest: { fullName: guestName, email: guestEmail, phoneNumber: guestPhone },
            status: slot ? 'viewing_confirmed' : 'viewing_requested',
            event: slot ? 'viewing_booked' : 'viewing_requested',
            bookingId: booking._id,
        });

        const tenantBody = slot
            ? `Your viewing for ${resolvedUnitName || 'a unit'} is confirmed for ${bookingDate.toDateString()} at ${bookingTime}.`
            : `Your viewing request for ${resolvedUnitName || 'a unit'} has been sent for ${bookingDate.toDateString()} at ${bookingTime}.`;
        await notifyTenant({
            tenantId: userId,
            email: tenant?.email || guestEmail,
            title: slot ? 'Viewing Booked' : 'Viewing Requested',
            body: tenantBody,
            type: 'viewing',
            relatedId: booking._id,
            emailSubject: slot ? `Viewing booked for ${resolvedUnitName || 'the unit'}` : `Viewing request sent for ${resolvedUnitName || 'the unit'}`,
            emailText: `Hi ${tenant?.fullName || guestName || 'there'},\n\n${tenantBody}\n\nMove-In by PayServe`,
            facilityId: resolvedFacilityId,
        });

        await notifyLandlord({
            landlordId: resolvedLandlordId,
            title: slot ? 'Viewing Booked' : 'Viewing Requested',
            body: `${tenant?.fullName || guestName || 'A prospect'} ${slot ? 'booked' : 'requested'} a viewing for ${resolvedUnitName || 'a unit'} on ${bookingDate.toDateString()} at ${bookingTime}.`,
            type: 'viewing',
            relatedId: booking._id,
            emailSubject: `${slot ? 'Viewing booked' : 'Viewing requested'} for ${resolvedUnitName || 'your unit'}`,
            emailText: `${tenant?.fullName || guestName || 'A prospect'} ${slot ? 'booked' : 'requested'} a viewing for ${resolvedUnitName || 'your unit'} on ${bookingDate.toDateString()} at ${bookingTime}.\n\nEmail: ${tenant?.email || guestEmail || 'N/A'}\nPhone: ${tenant?.phoneNumber || guestPhone || 'N/A'}\n\nMove-In by PayServe`,
            facilityId: resolvedFacilityId,
        });

        logger.info(`[move_in] Viewing ${slot ? 'booked' : 'requested'}: ${isGuest ? `guest ${guestEmail}` : `tenant ${userId}`}, unit ${resolvedUnitId}`);
        return reply.code(200).send({
            success: true,
            message: slot
                ? (isGuest ? 'Viewing request submitted. Our team will contact you shortly.' : 'Viewing booked.')
                : 'Viewing request sent to the landlord.',
            data: { bookingId: booking._id },
        });
    } catch (err) {
        logger.error('[move_in/viewing/book] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = book_slot;
