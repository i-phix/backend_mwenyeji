const payservedb = require('payservedb')
const update_lettable_area = async (request, reply) => {
    try {
        const { id } = request.params;
        const { totalLettableArea } = request.body

        const query = {
            _id: id
        }
        let data = {
            totalLettableArea: totalLettableArea
        }
        await payservedb.Facility.updateOne(query,data)
        return reply.code(200).send('Facility Total Lettable Area Updated successfully')
    }
    catch (err) {
        return reply.code(502).send({ error: err.message });
    }
}
module.exports = update_lettable_area