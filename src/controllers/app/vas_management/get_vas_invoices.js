const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_vas_invoices = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        const VasInvoiceModel = await getModel(
            "VasInvoice",
            payservedb.VasInvoice.schema,
            facilityId
        );

        const ValueAddedServiceModel = await getModel(
            "ValueAddedService",
            payservedb.ValueAddedService.schema,
            facilityId
        );

        const invoices = await VasInvoiceModel
            .find({ facilityId })
            .sort({ createdAt: -1 });

        const flattenedInvoices = await Promise.all(invoices.map(async (invoice) => {
            const customer = await payservedb.Customer.findById(invoice.customerId);

            const service = await ValueAddedServiceModel.findOne({
                _id: invoice.serviceId,
                facilityId: facilityId
            });

            const invoiceData = invoice.toObject();
            return {
                ...invoiceData,
                customerName: customer ? `${customer.firstName} ${customer.lastName}`.trim() : null,
                serviceName: service ? service.serviceName : null
            };
        }));

        return reply.code(200).send({
            success: true,
            flattenedInvoices
        });
    } catch (err) {
        console.error('Error in get_vas_invoices:', err);
        return reply.code(500).send({
            success: false,
            error: err.message
        });
    }
};

module.exports = get_vas_invoices;