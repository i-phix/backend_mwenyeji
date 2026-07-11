const payservedb = require('payservedb');

const add_tax = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            type,
            percentage,
            amount
        } = request.body;

        const data = new payservedb.Tax({
            type: type,
            percentage: percentage,
            amount: amount,
            disabled: false,
            facilityId: facilityId
        });

        await data.save();
        return reply.code(200).send('Tax added successfully');

    }
    catch (err) {
        return reply.code(502).send({ error: err.message });
    }
}

module.exports = add_tax