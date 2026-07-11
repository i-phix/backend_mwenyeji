const db = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const { sendEmail } = require('../../../../utils/send_new_email');
const logger = require('../../../../../config/winston');

const notifyLandlord = async (unit) => {
    try {
        if (!unit?.landlordId) return;
        let landlord = await db.moveIn.MoveInLandlordUser.findById(unit.landlordId).select('fullName email').lean();
        if (!landlord) landlord = await db.User.findById(unit.landlordId).select('fullName email').lean();
        if (!landlord?.email) return;

        await sendEmail(
            unit.facilityId || null,
            landlord.email,
            'Your Move-In listing is live',
            `Hi ${landlord.fullName || 'there'},\n\nYour listing "${unit.title || unit.name || 'Unit'}" has been approved and is now visible on Move-In.\n\nMove-In by PayServe`
        );
    } catch (err) {
        logger.error('[core/move_in/approve/email] ' + err.message);
    }
};

// PUT /api/core/move_in/listings/approve/:id
const approve_listing = async (request, reply) => {
    try {
        const { id } = request.params;

        // Try standalone MoveInUnit first
        const standalone = await db.moveIn.MoveInUnit.findByIdAndUpdate(
            id,
            { moveInApproval: 'approved', isListed: true },
            { new: true }
        );
        if (standalone) {
            await notifyLandlord(standalone);
            logger.info(`[core/move_in] MoveInUnit ${id} approved by ${request.user?.userId}`);
            return reply.code(200).send({ success: true, message: 'Listing approved and is now live.' });
        }

        // Fall back to facility units
        const facilities = await db.Facility.find({}).select('_id').lean();
        for (const facility of facilities) {
            const UnitModel = await getModel('Unit', db.Unit.schema, facility._id);
            const unit = await UnitModel.findByIdAndUpdate(
                id,
                { moveInApproval: 'approved', listedInMoveIn: true },
                { new: true }
            );
            if (unit) {
                await notifyLandlord(unit);
                logger.info(`[core/move_in] Facility unit ${id} approved by ${request.user?.userId}`);
                return reply.code(200).send({ success: true, message: 'Listing approved and is now live.' });
            }
        }

        return reply.code(404).send({ error: 'Unit not found.' });
    } catch (err) {
        logger.error('[core/move_in/approve] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = approve_listing;
