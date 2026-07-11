const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const delete_combine_unit = async (request, reply) => {
    try {
        const { unitId, facilityId } = request.params
        const UnitModel = await getModel('Unit', payservedb.Unit.schema, facilityId)

        await UnitModel.findByIdAndDelete(unitId)
        return reply.code(200).send('Deleted successfully');

    }
    catch (err) {
        return reply.code(502).send({ error: err.message });
    }
}
module.exports = delete_combine_unit


