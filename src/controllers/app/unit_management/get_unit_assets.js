const payservedb = require('payservedb')

const get_unit_assets = async (request, reply) => {
    try {
        const { unitId } = request.params;

        if (unitId) {
            const assets = await payservedb.UnitAsset.find({ unitId });
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