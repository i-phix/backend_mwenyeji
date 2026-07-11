const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const get_vas_payment = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const VasPaymentModel = await getModel('VasPayment', payservedb.VasPayment.schema, facilityId);
        const vasPayment = await VasPaymentModel.find({ facilityId: facilityId });
        return reply.code(200).send({ success: true, data: vasPayment });
    } catch (err) {
        console.error('Error in get_vas_payment:', err);
        return reply.code(400).send({ success: false, error: err.message });
    }
}

module.exports = get_vas_payment;