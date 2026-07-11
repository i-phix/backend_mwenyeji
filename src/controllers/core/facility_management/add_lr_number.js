const payservedb = require('payservedb')
const add_lr_number = async (request, reply) => {
    try {
        const { id } = request.params;
        const { LRNumber } = request.body

        const facility = await payservedb.Facility.findById(id);
        let landReferenceNumbers = facility.landReferenceNumbers === undefined ? [] : facility.landReferenceNumbers;
        let filter = landReferenceNumbers.filter((item) => {
            return item === LRNumber
        })
        if (filter.length > 0) {
            throw new Error('Land Reference Number already exists')
        }
        else {
            landReferenceNumbers.push(LRNumber);
            const query = {
                _id: id
            }
            let data = {
                landReferenceNumbers: landReferenceNumbers,

            }
            await payservedb.Facility.updateOne(query, data)
            return reply.code(200).send('Land Reference Number Saved successfully')
        }


    }
    catch (err) {
        return reply.code(502).send({ error: err.message });
    }
}
module.exports = add_lr_number