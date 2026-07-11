const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const add_vas_payment = async (request, reply) => {
    try {
        const { facilityId } = request.params
        const { customerId, amount, account } = request.body
        const VasPaymentModel = await getModel('VasPayment', payservedb.VasPayment.schema, facilityId)
        const data = new VasPaymentModel({
            facilityId: facilityId,
            customerId: customerId,
            amount: amount,
            account: account
        })
        await data.save()
        return reply.code(200).send({ message: 'Vas Payment added successfully', vasPayment: data })
    }
    catch (err) {
        return reply.code(502).send({ error: err.message })
    }
}

module.exports = add_vas_payment;

