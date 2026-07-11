const payservedb = require('payservedb')
const get_customer = async (request, reply) => {
    try {
        const { customerId } = request.params;
        const customer = await payservedb.Customer.findById(customerId);
        return reply.code(200).send(customer);

    }
    catch (err) {
        return reply.code(502).send({ error: err.message });
    }
}

module.exports = get_customer