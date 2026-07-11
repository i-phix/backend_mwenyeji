const payservedb = require('payservedb')
const { getModel } = require('../../../utils/getModel');
const add_new_unit_asset = async (request, reply) => {
    try {
        const { name } = request.body
        const { unitId,facilityId } = request.params;
        const UnitAssetModel = await getModel('UnitAsset', payservedb.UnitAsset.schema, facilityId)

        const nameExist = await UnitAssetModel.findOne({ name, unitId });

        if (nameExist) {
            throw new Error('Asset Name exists.')
        }
        else {
            let data = new UnitAssetModel({
                name, unitId
            })
            const response = data.save();
            return reply.code(200).send('New Asset has been added.')
        }
    }
    catch (err) {
        return reply.code(502).send({ error: err.message });
    }
}
module.exports = add_new_unit_asset