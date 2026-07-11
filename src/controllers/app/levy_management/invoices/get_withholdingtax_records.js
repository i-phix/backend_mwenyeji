const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const get_withholding_tax_records = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        const InvoiceWithholdingTax = await getModel(
            'InvoiceWithholdingTax',
            payservedb.InvoiceWithholdingTax.schema,
            facilityId
        );

        const Invoice = await getModel(
            'Invoice',
            payservedb.Invoice.schema,
            facilityId
        );

        const records = await InvoiceWithholdingTax.find({
            facilityId
        }).sort({ createdAt: -1 });

        const enrichedRecords = await Promise.all(
            records.map(async (record) => {

                const invoice = await Invoice.findById(record.invoiceId);

                let invoiceNumber = '';
                let accountNumber = '';
                let customerName = '';

                if (invoice) {
                    invoiceNumber = invoice.invoiceNumber;
                    accountNumber = invoice.accountNumber;

                    customerName =
                        `${invoice.client?.firstName || ''} ${invoice.client?.lastName || ''}`;
                }

                return {
                    _id: record._id,

                    invoiceId: record.invoiceId,
                    invoiceNumber,

                    accountNumber,

                    customerId: record.customerId,
                    customerName,

                    taxableAmount: record.taxableAmount,
                    withheldAmount: record.withheldAmount,

                    percentage: record.percentage,
                    taxName: record.taxName,

                    paymentId: record.paymentId,

                    currency: record.currency,

                    createdAt: record.createdAt
                };
            })
        );

        const totalWithheld = enrichedRecords.reduce(
            (sum, item) => sum + (item.withheldAmount || 0),
            0
        );

        return reply.code(200).send({
            success: true,
            message: 'WHT records retrieved successfully',

            statistics: {
                totalRecords: enrichedRecords.length,
                totalWithheld
            },

            records: enrichedRecords
        });

    } catch (err) {
        console.error('Error fetching WHT records:', err);

        return reply.code(500).send({
            success: false,
            message: err.message
        });
    }
};

module.exports = get_withholding_tax_records;