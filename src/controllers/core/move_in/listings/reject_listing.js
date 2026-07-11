const db = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const logger = require('../../../../../config/winston');

// PUT /api/core/move_in/listings/reject/:id
const reject_listing = async (request, reply) => {
    try {
        const { id } = request.params;

        const standalone = await db.moveIn.MoveInUnit.findByIdAndUpdate(
            id,
            { moveInApproval: 'rejected', isListed: false },
            { new: true }
        );
        if (standalone) {
            logger.info(`[core/move_in] MoveInUnit ${id} rejected by ${request.user?.userId}`);
            return reply.code(200).send({ success: true, message: 'Listing rejected.' });
        }

        const facilities = await db.Facility.find({}).select('_id').lean();
        for (const facility of facilities) {
            const UnitModel = await getModel('Unit', db.Unit.schema, facility._id);
            const unit = await UnitModel.findByIdAndUpdate(
                id,
                { moveInApproval: 'rejected', listedInMoveIn: false },
                { new: true }
            );
            if (unit) {
                logger.info(`[core/move_in] Facility unit ${id} rejected by ${request.user?.userId}`);
                return reply.code(200).send({ success: true, message: 'Listing rejected.' });
            }
        }

        return reply.code(404).send({ error: 'Unit not found.' });
    } catch (err) {
        logger.error('[core/move_in/reject] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = reject_listing;
