const payservedb = require('payservedb')
const { getModel } = require('../../../utils/getModel');
const get_unit_assets = async (request, reply) => {
    try {
        const { unitId, facilityId } = request.params;
        const UnitAssetModel = await getModel('UnitAsset', payservedb.UnitAsset.schema, facilityId)

        if (unitId) {
            const assets = await UnitAssetModel.find({ unitId });
            return reply.code(200).send(assets);
        }
        else {
            throw new Error('Assets Not found')
        }
    }
    catch (err) {
        return reply.code(502).send({ error: err.message });
    }
}
module.exports = get_unit_assets