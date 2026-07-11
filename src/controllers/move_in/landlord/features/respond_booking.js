const db = require('payservedb');
const { sendEmail } = require('../../../../utils/send_new_email');
const logger = require('../../../../../config/winston');
const { resolveMoveInUnit, upsertDeal } = require('../../utils/lifecycle');
const { notifyTenant } = require('../../utils/notifications');

const clean = (value) => String(value || '').trim();

const emailTenant = async (booking, subject, body) => {
    if (!booking.tenantEmail) return;
    await sendEmail(
        booking.facilityId || null,
        booking.tenantEmail,
        subject,
        body,
        null,
        'Move-In by PayServe'
    ).catch((err) => logger.error('[move_in/landlord/booking_email] ' + err.message));
};

const inAppTenant = async (booking, title, body) => notifyTenant({
    tenantId: booking.tenantId,
    email: null,
    title,
    body,
    type: 'viewing',
    relatedId: booking._id,
});

// PUT /api/move_in/landlord/viewings/bookings/:bookingId
// action: accept | reschedule | email | cancel
const respond_booking = async (request, reply) => {
    try {
        const { userId } = request.user;
        const { bookingId } = request.params;
        const { action, scheduledDate, scheduledTime, message } = request.body || {};

        if (!['accept', 'reschedule', 'email', 'cancel'].includes(action)) {
            return reply.code(400).send({ error: "action must be 'accept', 'reschedule', 'email' or 'cancel'." });
        }

        const booking = await db.moveIn.MoveInBooking.findOne({ _id: bookingId, landlordId: userId });
        if (!booking) return reply.code(404).send({ error: 'Viewing booking not found.' });

        const tenantName = booking.tenantName || 'there';
        const unitName = booking.unitName || 'the unit';
        const note = clean(message);
        const resolved = await resolveMoveInUnit({ unitId: booking.unitId, facilityId: booking.facilityId, requireListed: false });

        if (action === 'accept') {
            booking.status = 'confirmed';
            booking.landlordNote = note || booking.landlordNote;
            await booking.save();

            await emailTenant(
                booking,
                `Viewing confirmed for ${unitName}`,
                `Hi ${tenantName},\n\nYour viewing for ${unitName} has been confirmed for ${new Date(booking.scheduledDate).toDateString()} at ${booking.scheduledTime}.${note ? `\n\nNote: ${note}` : ''}\n\nMove-In by PayServe`
            );
            await inAppTenant(booking, 'Viewing Confirmed', `Your viewing for ${unitName} has been confirmed for ${new Date(booking.scheduledDate).toDateString()} at ${booking.scheduledTime}.`);
            await upsertDeal({
                resolved,
                tenant: booking.tenantId ? { _id: booking.tenantId, fullName: booking.tenantName, email: booking.tenantEmail, phoneNumber: booking.tenantPhone } : null,
                guest: { fullName: booking.tenantName, email: booking.tenantEmail, phoneNumber: booking.tenantPhone },
                status: 'viewing_confirmed',
                event: 'viewing_confirmed',
                bookingId: booking._id,
                notes: note || null,
            });
        }

        if (action === 'reschedule') {
            if (!scheduledDate || !scheduledTime) {
                return reply.code(400).send({ error: 'scheduledDate and scheduledTime are required for reschedule.' });
            }

            booking.status = 'pending';
            booking.scheduledDate = new Date(scheduledDate);
            booking.scheduledTime = scheduledTime;
            booking.landlordNote = note || booking.landlordNote;
            await booking.save();

            await emailTenant(
                booking,
                `Viewing rescheduled for ${unitName}`,
                `Hi ${tenantName},\n\nThe landlord proposed a new viewing time for ${unitName}: ${new Date(booking.scheduledDate).toDateString()} at ${booking.scheduledTime}.${note ? `\n\nNote: ${note}` : ''}\n\nMove-In by PayServe`
            );
            await inAppTenant(booking, 'Viewing Rescheduled', `The landlord proposed a new viewing time for ${unitName}: ${new Date(booking.scheduledDate).toDateString()} at ${booking.scheduledTime}.`);
            await upsertDeal({
                resolved,
                tenant: booking.tenantId ? { _id: booking.tenantId, fullName: booking.tenantName, email: booking.tenantEmail, phoneNumber: booking.tenantPhone } : null,
                guest: { fullName: booking.tenantName, email: booking.tenantEmail, phoneNumber: booking.tenantPhone },
                status: 'viewing_requested',
                event: 'viewing_rescheduled',
                bookingId: booking._id,
                notes: note || null,
            });
        }

        if (action === 'email') {
            if (!note) return reply.code(400).send({ error: 'message is required.' });
            booking.landlordNote = note;
            await booking.save();

            await emailTenant(
                booking,
                `Message about your viewing for ${unitName}`,
                `Hi ${tenantName},\n\n${note}\n\nMove-In by PayServe`
            );
            await inAppTenant(booking, 'Viewing Message', `The landlord sent a message about your viewing for ${unitName}.`);
        }

        if (action === 'cancel') {
            booking.status = 'cancelled';
            booking.cancelledAt = new Date();
            booking.cancelReason = note || 'Cancelled by landlord';
            await booking.save();

            await emailTenant(
                booking,
                `Viewing cancelled for ${unitName}`,
                `Hi ${tenantName},\n\nYour viewing for ${unitName} has been cancelled.${note ? `\n\nReason: ${note}` : ''}\n\nMove-In by PayServe`
            );
            await inAppTenant(booking, 'Viewing Cancelled', `Your viewing for ${unitName} has been cancelled.${note ? ` Reason: ${note}` : ''}`);
        }

        return reply.code(200).send({ success: true, message: 'Viewing booking updated.', data: booking });
    } catch (err) {
        logger.error('[move_in/landlord/respond_booking] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = respond_booking;
