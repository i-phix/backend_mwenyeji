const db = require('payservedb');
const mailer = require('../../../services/move_in_mailer');
const logger = require('../../../../config/winston');
const { getModel } = require('../../../utils/getModel');

// PUT /api/move_in/admin/units/:unitId/approve
// Body: { action: 'approved' | 'rejected', note?: string }
const approve_unit = async (request, reply) => {
    try {
        const { unitId } = request.params;
        const { action, note } = request.body || {};

        if (!['approved', 'rejected'].includes(action)) {
            return reply.code(400).send({ error: 'action must be "approved" or "rejected".' });
        }

        const unit = await db.moveIn.MoveInUnit.findById(unitId);
        if (!unit) return reply.code(404).send({ error: 'Unit not found.' });

        unit.moveInApproval = action;
        unit.isListed = action === 'approved';
        unit.moveInStatus = action === 'approved' ? 'listed' : 'draft';
        await unit.save();

        if (unit.source === 'payserve' && unit.sourceFacilityId && unit.sourceUnitId) {
            const UnitModel = await getModel('Unit', db.Unit.schema, unit.sourceFacilityId);
            await UnitModel.updateOne(
                { _id: unit.sourceUnitId },
                {
                    $set: {
                        listedInMoveIn: action === 'approved',
                        moveInApproval: action,
                        moveInStatus: action === 'approved' ? 'listed' : 'draft',
                        moveInListingId: unit._id,
                        moveInLastSyncedAt: new Date(),
                    },
                }
            );
        }

        // Notify the landlord via in-app notification
        await db.moveIn.MoveInNotification.create({
            recipientId:   unit.landlordId,
            recipientType: 'landlord',
            title:  action === 'approved' ? 'Unit Approved' : 'Unit Rejected',
            body:   action === 'approved'
                ? `Your unit "${unit.title}" has been approved and is now live.`
                : `Your unit "${unit.title}" was not approved.${note ? ' Note: ' + note : ''}`,
            type:      'unit_approval',
            relatedId: unit._id,
        });

        // Try email notification — landlord email requires joining with MoveInLandlordUser
        try {
            const landlord = unit.source === 'payserve'
                ? await db.User.findById(unit.payserveLandlordId || unit.landlordId).select('email').lean()
                : await db.moveIn.MoveInLandlordUser.findById(unit.landlordId).select('email').lean();
            if (landlord?.email) {
                if (action === 'approved') {
                    await mailer.unitApproved(landlord.email, unit.title);
                } else {
                    await mailer.unitRejected(landlord.email, unit.title, note);
                }
            }
        } catch (e) {
            logger.warn('[move_in/admin/approve_unit] email send skipped: ' + e.message);
        }

        logger.info(`[move_in/admin] Unit ${unitId} marked ${action} by admin ${request.user?.userId}`);
        return reply.code(200).send({ success: true, message: `Unit ${action}.`, data: { unitId, action } });
    } catch (err) {
        logger.error('[move_in/admin/approve_unit] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = approve_unit;
