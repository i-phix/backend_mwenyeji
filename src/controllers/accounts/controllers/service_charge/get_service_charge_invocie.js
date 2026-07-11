const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const get_service_charge_invoice = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const serviceChargeInvoiceModel = await getModel('ServiceChargeInvoiceUpload', payservedb.ServiceChargeInvoiceUpload.schema, facilityId);
        const serviceChargeInvoice = await serviceChargeInvoiceModel.find({ facilityId: facilityId });
        return reply.code(200).send({ success: true, data: serviceChargeInvoice });
    } catch (err) {
        console.error('Error in get_service_charge_invoice:', err);
        return reply.code(400).send({ success: false, error: err.message });
    }
};

module.exports = get_service_charge_invoice;