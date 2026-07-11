const db = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const logger = require('../../../../../config/winston');

// PUT /api/core/move_in/listings/override_price/:id
const override_price = async (request, reply) => {
    try {
        const { id } = request.params;
        const { moveInPrice } = request.body;

        if (!moveInPrice || isNaN(Number(moveInPrice)) || Number(moveInPrice) <= 0) {
            return reply.code(400).send({ error: 'A valid positive price is required.' });
        }

        const standalone = await db.moveIn.MoveInUnit.findByIdAndUpdate(
            id,
            { price: Number(moveInPrice) },
            { new: true }
        );
        if (standalone) {
            return reply.code(200).send({ success: true, message: 'Price overridden successfully.' });
        }

        const facilities = await db.Facility.find({}).select('_id').lean();
        for (const facility of facilities) {
            const UnitModel = await getModel('Unit', db.Unit.schema, facility._id);
            const unit = await UnitModel.findByIdAndUpdate(id, { moveInPrice: Number(moveInPrice) }, { new: true });
            if (unit) {
                return reply.code(200).send({ success: true, message: 'Price overridden successfully.' });
            }
        }

        return reply.code(404).send({ error: 'Unit not found.' });
    } catch (err) {
        logger.error('[core/move_in/override_price] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = override_price;
