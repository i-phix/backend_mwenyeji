const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');


const get_service_charge_invoice_by_id = async (request, reply) => {
    try {
        const { _id } = request.params;
        const { facilityId } = request.params;
        const serviceChargeInvoiceModel = await getModel('ServiceChargeInvoiceUpload', payservedb.ServiceChargeInvoiceUpload.schema, facilityId);
        const serviceChargeInvoice = await serviceChargeInvoiceModel.findOne({ _id: _id });
        return reply.code(200).send({ success: true, data: serviceChargeInvoice });
    } catch (err) {
        console.error('Error in get_service_charge_invoice:', err);
        return reply.code(400).send({ success: false, error: err.message });
    }
};


const get_service_charge_payment_by_id = async (request, reply) => {
    try {
        const { _id } = request.params;
        const { facilityId } = request.params;
        const serviceChargePaymentModel = await getModel('ServiceChargePayment', payservedb.ServiceChargePayment.schema, facilityId);
        const serviceChargePayment = await serviceChargePaymentModel.findOne({ _id: _id });
        return reply.code(200).send({ success: true, data: serviceChargePayment });
    } catch (err) {
        console.error('Error in get_service_charge_invoice:', err);
        return reply.code(400).send({ success: false, error: err.message });
    }
}

const edit_service_charge_payment = async (request, reply) => {
    try {
        const { _id } = request.params;
        const { facilityId } = request.params;
        newServiceChargePayment = request.body;
        const serviceChargePaymentModel = await getModel('ServiceChargePayment', payservedb.ServiceChargePayment.schema, facilityId);
        const serviceChargePayment = await serviceChargePaymentModel.findOneAndUpdate({ _id: _id }, newServiceChargePayment);
        return reply.code(200).send({ success: true, data: serviceChargePayment });
    } catch (err) {
        console.error('Error in get_service_charge_invoice:', err);
        return reply.code(400).send({ success: false, error: err.message });
    }
};

const edit_service_charge_invoice = async (request, reply) => {
    try {
        const { _id } = request.params;
        const { facilityId } = request.params;
        newServiceChargeInvoice = request.body;
        const serviceChargeInvoiceModel = await getModel('ServiceChargeInvoiceUpload', payservedb.ServiceChargeInvoiceUpload.schema, facilityId);
        const serviceChargeInvoice = await serviceChargeInvoiceModel.findOneAndUpdate({ _id: _id }, newServiceChargeInvoice, { new: true });
        return reply.code(200).send({ success: true, data: serviceChargeInvoice });
    } catch (err) {
        console.error('Error in get_service_charge_invoice:', err);
        return reply.code(400).send({ success: false, error: err.message });
    }
};



module.exports = {
    edit_service_charge_invoice,
    get_service_charge_invoice_by_id,
    get_service_charge_payment_by_id,
    edit_service_charge_payment,
};