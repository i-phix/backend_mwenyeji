const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const get_vas_invoice_by_id = async (request, reply) => {
    try {
        const { _id } = request.params;
        const { facilityId } = request.params;
        const VasInvoiceModel = await getModel('VasInvoicesQuickBooks', payservedb.VasInvoicesQuickBooks.schema, facilityId);
        const vasInvoice = await VasInvoiceModel.findById(_id);
        return reply.code(200).send({ success: true, data: vasInvoice });
    }
    catch (err) {
        console.error('Error in get_vas_invoice:', err);
        return reply.code(400).send({ success: false, error: err.message });
    }
}

const get_vas_payment_by_id = async (request, reply) => {
    try {
        const { _id } = request.params;
        const { facilityId } = request.params;
        const VasPaymentModel = await getModel('VasPayment', payservedb.VasPayment.schema, facilityId);
        const vasPayment = await VasPaymentModel.findById(_id);
        return reply.code(200).send({ success: true, data: vasPayment });
    }
    catch (err) {
        console.error('Error in get_vas_payment:', err);
        return reply.code(400).send({ success: false, error: err.message });
    }
}

const edit_vas_invoice = async (request, reply) => {
    try {
        const { _id } = request.params;
        const { facilityId } = request.params;
        newVasInvoice = request.body;
        const VasInvoiceModel = await getModel('VasInvoicesQuickBooks', payservedb.VasInvoicesQuickBooks.schema, facilityId);
        const vasInvoice = await VasInvoiceModel.findByIdAndUpdate(_id, newVasInvoice);
        return reply.code(200).send({ success: true, data: vasInvoice });
    }
    catch (err) {
        console.error('Error in edit_vas_invoice:', err);
        return reply.code(400).send({ success: false, error: err.message });
    }
}

const edit_vas_payment = async (request, reply) => {
    try {
        const { _id } = request.params;
        const { facilityId } = request.params;
        newVasPayment = request.body;
        const VasPaymentModel = await getModel('VasPayment', payservedb.VasPayment.schema, facilityId);
        const vasPayment = await VasPaymentModel.findByIdAndUpdate(_id, newVasPayment);
        return reply.code(200).send({ success: true, data: vasPayment });
    }
    catch (err) {
        console.error('Error in edit_vas_payment:', err);
        return reply.code(400).send({ success: false, error: err.message });
    }
}

module.exports = {
    get_vas_invoice_by_id,
    get_vas_payment_by_id,
    edit_vas_invoice,
    edit_vas_payment
};