const db = require('payservedb');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const logger = require('../../../../config/winston');
const { clean, normalizeEmail, resolveMoveInUnit, upsertDeal, setStandaloneUnitStatus } = require('../utils/lifecycle');
const { notifyLandlord, notifyTenant, notifyEmail } = require('../utils/notifications');

const generatedPassword = () => {
    const base = crypto.randomBytes(6).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    return `${base.slice(0, 8)}Aa1!`;
};

// POST /api/move_in/applications/submit
// Authenticated tenant submits a Move-In application for a specific unit
const submit_application = async (request, reply) => {
    try {
        const userId = request.user?.userId || null;
        const {
            unitId,
            facilityId,
            bookingId,
            desiredMoveInDate,
            message,
            fullName,
            email,
            phoneNumber,
            occupation,
            dob,
            gender,
            termsAccepted,
        } = request.body;

        if (!unitId) {
            return reply.code(400).send({ error: 'unitId is required.' });
        }

        const guestName = clean(fullName);
        const guestEmail = normalizeEmail(email);
        const guestPhone = clean(phoneNumber);
        const isGuest = !userId;

        if (isGuest && (!guestName || !guestEmail || !guestPhone)) {
            return reply.code(400).send({ error: 'fullName, email and phoneNumber are required.' });
        }
        if (isGuest && termsAccepted === false) {
            return reply.code(400).send({ error: 'You must accept the terms and conditions before applying.' });
        }

        // Tenants registered via Move-In portal live in payserve_movein (MoveInUser)
        let tenant = userId ? await db.moveIn.MoveInUser.findById(userId).lean() : null;
        if (userId && !tenant) return reply.code(404).send({ error: 'User not found.' });
        let createdPassword = null;

        if (isGuest && db.moveIn.MoveInUser) {
            tenant = await db.moveIn.MoveInUser.findOne({
                $or: [{ email: guestEmail }, { phoneNumber: guestPhone }],
            }).lean();

            if (!tenant) {
                createdPassword = generatedPassword();
                const hashedPassword = await bcrypt.hash(createdPassword, 10);
                tenant = await db.moveIn.MoveInUser.create({
                    fullName: guestName,
                    email: guestEmail,
                    phoneNumber: guestPhone,
                    password: hashedPassword,
                    isEnabled: true,
                });
            }
        }

        let booking = null;
        if (bookingId) {
            const bookingFilter = {
                _id: bookingId,
                status: { $ne: 'cancelled' },
                ...(userId ? { tenantId: userId } : { tenantEmail: guestEmail, isGuest: true }),
            };
            booking = await db.moveIn.MoveInBooking.findOne(bookingFilter).lean();

            if (!booking) {
                return reply.code(404).send({ error: 'Viewing booking not found for this account.' });
            }

            if (String(booking.unitId) !== String(unitId)) {
                return reply.code(400).send({ error: 'The selected viewing does not belong to this unit.' });
            }
        }

        const resolved = await resolveMoveInUnit({ unitId, facilityId, requireListed: true });

        // Check for duplicate application
        const existing = await db.moveIn.MoveInApplication.findOne({
            unitId,
            status: { $in: ['pending', 'assigned', 'approved'] },
            ...(tenant?._id ? { tenantId: tenant._id } : { tenantEmail: guestEmail, isGuest: true }),
        });
        if (existing) {
            return reply.code(409).send({ error: 'You already have an active application for this unit.' });
        }

        const application = new db.moveIn.MoveInApplication({
            unitId,
            facilityId: resolved.facilityId,
            bookingId: booking?._id || null,
            source: isGuest ? 'guest' : (booking ? 'viewing' : 'direct'),
            unitName: resolved.unitName,
            facilityName: resolved.facilityName,
            tenantId: tenant?._id || userId || null,
            tenantName: tenant?.fullName || guestName,
            tenantEmail: tenant?.email || guestEmail,
            tenantPhone: tenant?.phoneNumber || guestPhone,
            isGuest,
            generatedAccountId: createdPassword ? tenant._id : null,
            occupation: clean(occupation) || null,
            dob: dob ? new Date(dob) : null,
            gender: clean(gender) || null,
            termsAcceptedAt: termsAccepted ? new Date() : null,
            desiredMoveInDate: desiredMoveInDate ? new Date(desiredMoveInDate) : null,
            message: message || null,
            status: 'pending',
            landlordId: resolved.landlordId,
        });

        await application.save();

        const deal = await upsertDeal({
            resolved,
            tenant,
            guest: { fullName: guestName, email: guestEmail, phoneNumber: guestPhone },
            status: 'applied',
            event: booking ? 'application_submitted_from_viewing' : 'application_submitted',
            applicationId: application._id,
            bookingId: booking?._id || null,
            desiredMoveInDate: application.desiredMoveInDate,
            notes: message || null,
        });

        if (resolved.source === 'standalone') {
            await setStandaloneUnitStatus(resolved.unitId, 'under_offer', deal._id);
        }

        await db.moveIn.MoveInAuditLog.create({
            action: booking ? 'application_submitted_from_viewing' : 'application_submitted',
            resourceType: 'application',
            resourceId: application._id,
            details: `${isGuest ? 'Guest' : 'Tenant'} ${tenant?.fullName || guestName || userId} submitted an application for ${resolved.unitName || unitId}.`,
            ipAddress: request.ip || null,
        }).catch((auditErr) => logger.warn('[move_in/applications/submit/audit] ' + auditErr.message));

        const prospectName = tenant?.fullName || guestName || 'A prospect';
        await notifyLandlord({
            landlordId: resolved.landlordId,
            title: 'New Application',
            body: `${prospectName} applied for ${resolved.unitName || 'a unit'}.`,
            type: 'application',
            relatedId: application._id,
            emailSubject: `New application for ${resolved.unitName || 'your unit'}`,
            emailText: `${prospectName} submitted an application for ${resolved.unitName || 'your unit'}.\n\nEmail: ${tenant?.email || guestEmail || 'N/A'}\nPhone: ${tenant?.phoneNumber || guestPhone || 'N/A'}\nOccupation: ${clean(occupation) || 'N/A'}\nDOB: ${dob || 'N/A'}\nGender: ${clean(gender) || 'N/A'}\n\nMove-In by PayServe`,
            facilityId: resolved.facilityId,
        });

        if (createdPassword) {
            await notifyEmail({
                to: tenant.email,
                subject: 'Your Move-In account has been created',
                text: `Hi ${tenant.fullName},\n\nWe created a Move-In account for you after your application for ${resolved.unitName || 'the unit'}.\n\nLogin email: ${tenant.email}\nTemporary password: ${createdPassword}\n\nPlease sign in and change your password.\n\nMove-In by PayServe`,
                facilityId: resolved.facilityId,
            });
        }

        await notifyTenant({
            tenantId: tenant?._id || userId,
            email: tenant?.email || guestEmail,
            title: 'Application Submitted',
            body: `Your application for ${resolved.unitName || 'the unit'} has been submitted.`,
            type: 'application',
            relatedId: application._id,
            emailSubject: `Application received for ${resolved.unitName || 'the unit'}`,
            emailText: `Hi ${tenant?.fullName || guestName || 'there'},\n\nWe received your application for ${resolved.unitName || 'the unit'}. The landlord will review it and contact you with next steps.\n\nMove-In by PayServe`,
            facilityId: resolved.facilityId,
        });

        logger.info(`[move_in] Application submitted by ${isGuest ? `guest ${guestEmail}` : `tenant ${userId}`} for unit ${unitId}`);
        return reply.code(201).send({
            success: true,
            message: isGuest ? 'Application request submitted. Our team will contact you shortly.' : (booking ? 'Application submitted from your viewing booking.' : 'Application submitted successfully.'),
            data: { applicationId: application._id },
        });
    } catch (err) {
        logger.error('[move_in/applications/submit] ' + err.message);
        return reply.code(err.statusCode || 502).send({ error: err.message });
    }
};

module.exports = submit_application;
