const payservedb = require('payservedb');

const filter_phone_number = async (request, reply) => {

    try {
        const { phoneNumber } = request.params;
        const filteredPhoneNumber = phoneNumber.slice(-9);
        const customer = await payservedb.Customer.findOne({ phoneNumber: filteredPhoneNumber });
        if (customer) {
            return reply.code(200).send('Customer PhoneNumber Exists')
        }
        else {
            throw new Error("Customer doesn't exist")
        }
    }
    catch (err) {
        return reply.code(502).send(err.message)
    }
}
module.exports = filter_phone_number