const payservedb = require("payservedb");
const { getModel } = require('../../../utils/getModel');

const get_vas_invoice_by_id = async (request, reply) => {
    try {
        const { facilityId, invoiceId } = request.params;

        // Changed from "Invoice" to "VasInvoice"
        const invoiceModel = await getModel(
            "VasInvoice",
            payservedb.VasInvoice.schema,
            facilityId
        );

        const invoice = await invoiceModel.findOne({ _id: invoiceId });

        if (!invoice) {
            return reply.code(404).send({ message: "Invoice not found." });
        }

        const customer = await payservedb.Customer.findById(invoice.customerId);

        // Attach customer info to the invoice
        const customerInvoice = {
            ...invoice.toObject(),
            customerInfo: customer
                ? {
                    fullName: `${customer.firstName} ${customer.lastName}`
                }
                : null,
        };

        return reply.code(200).send({
            message: "Invoice retrieved successfully",
            invoice: customerInvoice,
        });
    } catch (err) {
        console.error("Error in retrieving invoice:", err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = get_vas_invoice_by_id;