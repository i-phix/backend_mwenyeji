const payservedb = require('payservedb');

const get_invoice_billing = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const data = await payservedb.InvoiceBillingSetting.findOne({ facilityId });

        if (data) {
            return reply.code(200).send({ success: true, data });
        } else {
            return reply.code(200).send({ success: false, message: 'No data found' });
        }
    } catch (err) {
        return reply.code(502).send({ success: false, error: err.message });
    }
};

module.exports = get_invoice_billing;
