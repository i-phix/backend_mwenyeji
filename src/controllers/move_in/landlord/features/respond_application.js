const db = require('payservedb');
const { sendEmail } = require('../../../../utils/send_new_email');
const logger = require('../../../../../config/winston');
const { resolveMoveInUnit, upsertDeal, setStandaloneUnitStatus, ensureCommissionDue } = require('../../utils/lifecycle');
const { convertDealToPayServeRental } = require('../../utils/payserve_conversion');

// PUT /api/move_in/landlord/applications/:applicationId
// action: 'approve' | 'reject' | 'rent'
const respond_application = async (request, reply) => {
    try {
        const { userId } = request.user;
        const { applicationId } = request.params;
        const { action, note } = request.body;

        if (!['approve', 'reject', 'rent'].includes(action)) {
            return reply.code(400).send({ error: "action must be 'approve', 'reject' or 'rent'." });
        }

        const application = await db.moveIn.MoveInApplication.findOne({ _id: applicationId, landlordId: userId });
        if (!application) return reply.code(404).send({ error: 'Application not found.' });
        if (action !== 'rent' && application.status !== 'pending') {
            return reply.code(400).send({ error: `Application is already ${application.status}.` });
        }
        if (action === 'rent' && !['approved', 'assigned'].includes(application.status)) {
            return reply.code(400).send({ error: 'Only approved applications can be marked as rented.' });
        }

        const resolved = await resolveMoveInUnit({
            unitId: application.unitId,
            facilityId: application.facilityId,
            requireListed: false,
        });

        application.status    = action === 'approve' ? 'approved' : (action === 'rent' ? 'completed' : 'rejected');
        application.adminNote = note || null;
        application.assignedAt = action === 'approve' || action === 'rent' ? new Date() : null;
        await application.save();

        const deal = await upsertDeal({
            resolved,
            tenant: application.tenantId ? { _id: application.tenantId, fullName: application.tenantName, email: application.tenantEmail, phoneNumber: application.tenantPhone } : null,
            guest: { fullName: application.tenantName, email: application.tenantEmail, phoneNumber: application.tenantPhone },
            status: action === 'approve' ? 'application_approved' : (action === 'rent' ? 'rented' : 'lost'),
            event: action === 'approve' ? 'application_approved' : (action === 'rent' ? 'application_marked_rented' : 'application_rejected'),
            applicationId: application._id,
            desiredMoveInDate: application.desiredMoveInDate,
            notes: note || null,
        });

        if (resolved.source === 'standalone') {
            await setStandaloneUnitStatus(resolved.unitId, action === 'rent' ? 'rented' : (action === 'approve' ? 'under_offer' : 'listed'), action === 'reject' ? null : deal._id);
        }

        let commission = null;
        let conversion = null;
        if (action === 'rent') {
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
                    notes: `Commission generated from application ${application._id}.`,
                });
            }
        }

        const title = action === 'approve' ? 'Application Approved' : (action === 'rent' ? 'Rental Confirmed' : 'Application Rejected');
        const body = action === 'approve'
            ? `Your application for ${application.unitName || 'a unit'} has been approved.`
            : action === 'rent'
                ? `Your rental for ${application.unitName || 'a unit'} has been confirmed.`
                : `Your application for ${application.unitName || 'a unit'} was not successful.${note ? ' Note: ' + note : ''}`;

        if (application.tenantId) {
            await db.moveIn.MoveInNotification.create({
                recipientId:   application.tenantId,
                recipientType: 'tenant',
                title,
                body,
                type:          'application',
                relatedId:     application._id,
            });
        }

        if (application.tenantEmail) {
            await sendEmail(
                application.facilityId || null,
                application.tenantEmail,
                `Move-In ${title}`,
                `Hi ${application.tenantName || 'there'},\n\n${body}\n\nMove-In by PayServe`
            ).catch((err) => logger.error('[move_in/landlord/respond_application/email] ' + err.message));
        }

        return reply.code(200).send({
            success: true,
            message: `Application ${application.status}.`,
            data: { dealId: deal._id, commissionId: commission?._id || null, conversion },
        });
    } catch (err) {
        logger.error('[move_in/landlord/respond_application] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = respond_application;
