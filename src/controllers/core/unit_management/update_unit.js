const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const update_unit = async (request, reply) => {
    try {
        const { unitId, facilityId } = request.params;
        const { unitName, division, floorUnit, unitType, lrNumber } = request.body;
        const UnitModel = await getModel('Unit', payservedb.Unit.schema, facilityId)

        const query = { _id: unitId };
        const data = {
            name: unitName,
            division,
            unitType,
            floorUnitNo: floorUnit,
            landRateNumber: lrNumber,
        };

        await UnitModel.updateOne(query, data);
        return reply.code(200).send('Unit updated successfully');
    } catch (err) {
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = update_unit;
