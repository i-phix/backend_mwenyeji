const payservedb = require('payservedb')
const delete_asset = async (request, reply) => {
    try {
        const { id } = request.params;
        await payservedb.FacilityAsset.findByIdAndDelete(id)
        return reply.code(200).send('Facility Asset deleted successfully')
    }
    catch (err) {
        return reply.code(502).send({ error: err.message });
    }
}
module.exports = delete_asset