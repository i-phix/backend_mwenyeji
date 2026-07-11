const payservedb = require('payservedb')
const { getModel } = require('../../../utils/getModel');
const delete_unit_asset = async (request, reply) => {
    try {
        const { id, facilityId } = request.params;
        const UnitAssetModel = await getModel('UnitAsset', payservedb.UnitAsset.schema, facilityId)

        await UnitAssetModel.findByIdAndDelete(id)
        return reply.code(200).send('Unit Asset deleted successfully')
    }
    catch (err) {
        return reply.code(502).send({ error: err.message });
    }
}

module.exports = delete_unit_asset