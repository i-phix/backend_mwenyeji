const payservedb = require('payservedb')

const delete_unit_asset = async (request, reply) => {
    try {
        const { unitId } = request.params;
        await payservedb.UnitAsset.findByIdAndDelete(unitId)
        return reply.code(200).send('Unit Asset deleted successfully')
    }
    catch (err) {
        return reply.code(502).send({ error: err.message });
    }
}

module.exports = delete_unit_asset