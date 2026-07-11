const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const update_unit_name = async (request, reply) => {
    try {
        const { unitId,facilityId } = request.params;
        const { unitName } = request.body;
        const UnitModel = await getModel('Unit', payservedb.Unit.schema, facilityId)

        // const unit = await payservedb.Unit.findById(unitId);

        const query = {
            _id: unitId
        }
        const data = {
            name: unitName
        }

        // const data = { $set: { name: unitName } };

        await UnitModel.updateOne(query, data)

        return reply.code(200).send('Unit name updated successfully');
    } catch (err) {
        return reply.code(502).send({ error: err.message });
    }
}

module.exports = update_unit_name
