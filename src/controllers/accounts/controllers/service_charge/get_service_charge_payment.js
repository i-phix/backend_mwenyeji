const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const get_service_charge_payment = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const serviceChargePaymentModel = await getModel('ServiceChargePayment', payservedb.ServiceChargePayment.schema, facilityId);
        const serviceChargePayment = await serviceChargePaymentModel.find({ facilityId: facilityId });
        return reply.code(200).send({ success: true, data: serviceChargePayment });
    } catch (err) {
        console.error('Error in get_service_charge_payment:', err);
        return reply.code(400).send({ success: false, error: err.message });
    }
}

module.exports = get_service_charge_payment;