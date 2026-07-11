const db = require('payservedb');
const logger = require('../../../../../config/winston');

// PUT /api/core/move_in/applications/assign/:applicationId
const assign_application = async (request, reply) => {
    try {
        const { applicationId } = request.params;
        const { note } = request.body;

        const application = await db.moveIn.MoveInApplication.findById(applicationId);
        if (!application) return reply.code(404).send({ error: 'Application not found.' });
        if (application.status !== 'pending') {
            return reply.code(400).send({ error: 'Only pending applications can be assigned.' });
        }

        // Find the landlord who owns the unit's facility
        const facility = await db.Facility.findById(application.facilityId).lean();
        let landlordId = null;
        if (facility) {
            const landlordUser = await db.User.findOne({
                type: 'Landlord',
                'customerData.facilityId': application.facilityId,
            }).select('_id').lean();
            if (landlordUser) landlordId = landlordUser._id;
        }

        application.status = 'assigned';
        application.adminNote = note || null;
        application.assignedAt = new Date();
        if (landlordId) application.landlordId = landlordId;
        await application.save();

        logger.info(`[core/move_in] Application ${applicationId} assigned by ${request.user?.userId}`);
        return reply.code(200).send({ success: true, message: 'Application assigned to landlord.' });
    } catch (err) {
        logger.error('[core/move_in/applications/assign] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = assign_application;
