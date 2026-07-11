const payservedb = require('payservedb')
const delete_lr_number = async (request, reply) => {
    try {
        const { id } = request.params;
        const { lrNumber } = request.body

        const facility = await payservedb.Facility.findById(id);
        let landReferenceNumbers = facility.landReferenceNumbers === undefined ? [] : facility.landReferenceNumbers;
        let filter = landReferenceNumbers.filter((item) => {
            return item !== lrNumber
        })


        const query = {
            _id: id
        }
        let data = {
            landReferenceNumbers: filter,

        }
        await payservedb.Facility.updateOne(query, data)
        return reply.code(200).send('Land Reference Number Removed successfully')



    }
    catch (err) {
        return reply.code(502).send({ error: err.message });
    }
}
module.exports = delete_lr_number