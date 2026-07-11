const db = require('payservedb');
const mailer = require('../../../services/move_in_mailer');
const logger = require('../../../../config/winston');

// PUT /api/move_in/admin/applications/:appId/screen
// Body: { action: 'pass' | 'fail', note?: string }
// 'pass'  → status 'assigned' (forwarded to landlord), notify tenant
// 'fail'  → status 'rejected', notify tenant
const screen_application = async (request, reply) => {
    try {
        const { appId } = request.params;
        const { action, note } = request.body || {};

        if (!['pass', 'fail'].includes(action)) {
            return reply.code(400).send({ error: 'action must be "pass" or "fail".' });
        }

        const app = await db.moveIn.MoveInApplication.findById(appId);
        if (!app) return reply.code(404).send({ error: 'Application not found.' });
        if (app.status !== 'pending') {
            return reply.code(409).send({ error: `Application is already "${app.status}" — cannot screen again.` });
        }

        app.status    = action === 'pass' ? 'assigned' : 'rejected';
        app.adminNote = note || null;
        app.assignedAt = action === 'pass' ? new Date() : null;
        await app.save();

        // In-app notification to tenant
        await db.moveIn.MoveInNotification.create({
            recipientId:   app.tenantId,
            recipientType: 'tenant',
            title:  action === 'pass' ? 'Application in Review' : 'Application Update',
            body:   action === 'pass'
                ? `Your application for "${app.unitName || 'the unit'}" has passed screening and is being reviewed by the landlord.`
                : `Your application for "${app.unitName || 'the unit'}" was not successful at this time.${note ? ' ' + note : ''}`,
            type:      'application',
            relatedId: app._id,
        });

        // Email
        try {
            if (app.tenantEmail) {
                if (action === 'pass') {
                    await mailer.applicationScreened(app.tenantEmail, app.unitName || 'the unit');
                } else {
                    await mailer.applicationRejected(app.tenantEmail, app.unitName || 'the unit', note);
                }
            }
        } catch (e) {
            logger.warn('[move_in/admin/screen] email skipped: ' + e.message);
        }

        logger.info(`[move_in/admin] Application ${appId} screened: ${action} by admin ${request.user?.userId}`);
        return reply.code(200).send({ success: true, message: `Application ${action === 'pass' ? 'passed screening' : 'rejected'}.` });
    } catch (err) {
        logger.error('[move_in/admin/screen_application] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = screen_application;
