const payservedb = require('payservedb')
const update_facility_info = async (request, reply) => {
    try {
        const { id } = request.params;
        const { defaultMeasurement } = request.body

        const query = {
            _id: id
        }
        let data = {
            defaultMeasurement
        }
        await payservedb.Facility.updateOne(query,data)
        return reply.code(200).send('Facility Default Measurement Updated successfully')
    }
    catch (err) {
        return reply.code(502).send({ error: err.message });
    }
}
module.exports = update_facility_info