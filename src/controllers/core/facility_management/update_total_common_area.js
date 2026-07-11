const payservedb = require('payservedb')
const update_total_common_area = async (request, reply) => {
    try {
        const { id } = request.params;
        const { totalCommonArea } = request.body

        const query = {
            _id: id
        }
        let data = {
            totalCommonArea: totalCommonArea
        }
        await payservedb.Facility.updateOne(query,data)
        return reply.code(200).send('Facility Total Common Area Updated successfully')
    }
    catch (err) {
        return reply.code(502).send({ error: err.message });
    }
}
module.exports = update_total_common_area