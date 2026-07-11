const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const add_service_charge_invoice = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        const { customerId, amount, account } = request.body;

        const ServiceChargePaymentModel = await getModel('ServiceChargePayment', payservedb.ServiceChargePayment.schema, facilityId);

        // const existingServiceChargeInvoice = await ServiceChargePaymentModel.findOne({
        //     invoiceNumber: serviceChargeInvoice.invoiceNumber,
        // });

        // if (existingServiceChargeInvoice) {
        //     return reply.code(409).send({ error: 'Service Charge Invoice already exists' });
        // }

        const data = new ServiceChargePaymentModel({
            facilityId: facilityId,
            customerId: customerId,
            amount: amount,
            account: account,
        });

        await data.save();

        return reply.code(200).send({ message: 'Service Charge Invoice added successfully', serviceChargeInvoice: data });
    } catch (err) {
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = add_service_charge_invoice;