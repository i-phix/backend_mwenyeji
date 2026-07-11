const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const add_service_charge_invoice = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        const { customerId, item, description, quantity, rate, vat, account, } = request.body;

        const serviceChargeModel = await getModel('ServiceChargeInvoiceUpload', payservedb.ServiceChargeInvoiceUpload.schema, facilityId);

        const data = new serviceChargeModel({
            facilityId: facilityId,
            customerId: customerId,
            item: item,
            description: description,
            quantity: quantity,
            rate: rate,
            vat: vat,
            account: account,
        });

        await data.save();

        return reply.code(200).send({ message: 'Service Charge added successfully', serviceCharge: data });
    } catch (err) {
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = add_service_charge_invoice;