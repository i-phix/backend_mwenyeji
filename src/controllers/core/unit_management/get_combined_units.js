const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const get_combined_units = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const CombinedUnitModel = await getModel('CombinedUnit', payservedb.CombinedUnit.schema, facilityId)

        let combinedUnits = await CombinedUnitModel.find({}).sort({ _id: -1 });



        reply.code(200).send(combinedUnits);


    } catch (err) {
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_combined_units;
