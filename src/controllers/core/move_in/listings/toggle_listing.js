const db = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const logger = require('../../../../../config/winston');

// PUT /api/core/move_in/listings/toggle/:id
const toggle_listing = async (request, reply) => {
    try {
        const { id } = request.params;
        const { listedInMoveIn } = request.body;

        if (typeof listedInMoveIn !== 'boolean') {
            return reply.code(400).send({ error: 'listedInMoveIn (boolean) is required.' });
        }

        const update = listedInMoveIn
            ? { isListed: true, moveInApproval: 'approved', moveInStatus: 'listed' }
            : { isListed: false, moveInStatus: 'approved_unlisted' };

        const standalone = await db.moveIn.MoveInUnit.findByIdAndUpdate(
            id,
            update,
            { new: true }
        );
        if (standalone) {
            return reply.code(200).send({ success: true, message: `Listing ${listedInMoveIn ? 'activated' : 'deactivated'}.` });
        }

        const facilities = await db.Facility.find({}).select('_id').lean();
        for (const facility of facilities) {
            const UnitModel = await getModel('Unit', db.Unit.schema, facility._id);
            const facilityUpdate = listedInMoveIn
                ? { listedInMoveIn: true, moveInApproval: 'approved' }
                : { listedInMoveIn: false };
            const unit = await UnitModel.findByIdAndUpdate(id, facilityUpdate, { new: true });
            if (unit) {
                return reply.code(200).send({ success: true, message: `Listing ${listedInMoveIn ? 'activated' : 'deactivated'}.` });
            }
        }

        return reply.code(404).send({ error: 'Unit not found.' });
    } catch (err) {
        logger.error('[core/move_in/toggle] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = toggle_listing;
