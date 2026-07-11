const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const get_vas_invoice = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const VasInvoiceModel = await getModel('VasInvoicesQuickBooks', payservedb.VasInvoicesQuickBooks.schema, facilityId);
        const vasInvoice = await VasInvoiceModel.find({ facilityId: facilityId });
        return reply.code(200).send({ success: true, data: vasInvoice });
    }
    catch (err) {
        console.error('Error in get_vas_invoice:', err);
        return reply.code(400).send({ success: false, error: err.message });
    }
}

module.exports = get_vas_invoice;