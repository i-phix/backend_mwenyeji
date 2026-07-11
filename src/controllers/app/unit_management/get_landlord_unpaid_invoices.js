const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const mongoose = require('mongoose');

const get_landlord_unpaid_invoices = async (request, reply) => {
    try {
        const { facilityId, customerId } = request.params;

        const invoiceModel = await getModel(
            'Invoice',
            payservedb.Invoice.schema,
            facilityId
        );

        const clientObjectId = new mongoose.Types.ObjectId(customerId);

        // ✅ Fetch only unpaid / partially paid invoices
        const invoices = await invoiceModel.find({
            'client.clientId': clientObjectId,
            status: { $in: ['Unpaid', 'Partially Paid'] }
        }).lean();

        if (!invoices.length) {
            return reply.code(200).send({
                invoices: [],
                summary: {
                    totalInvoices: 0,
                    totalAmount: 0,
                    totalPaid: 0,
                    totalBalance: 0,
                    customerId
                }
            });
        }

        const processedInvoices = invoices.map(invoice => {
            const totalPaid = invoice.amountPaid || 0;
            const totalAmount = invoice.totalAmount || 0;

            return {
                _id: invoice._id,
                invoiceNumber: invoice.invoiceNumber,
                invoiceType: invoice.items?.[0]?.description || invoice.whatFor?.invoiceType,
                unitName: invoice.unit?.name || 'N/A',
                unitId: invoice.unit?.id,
                issueDate: invoice.issueDate,
                dueDate: invoice.dueDate,
                totalAmount,
                amountPaid: totalPaid,
                balance: totalAmount - totalPaid,
                status: invoice.status,
                currency: invoice.currency,
                invoiceUrl: invoice.invoiceUrl
            };
        });

        const summary = {
            totalInvoices: processedInvoices.length,
            totalAmount: processedInvoices.reduce((s, i) => s + i.totalAmount, 0),
            totalPaid: processedInvoices.reduce((s, i) => s + i.amountPaid, 0),
            totalBalance: processedInvoices.reduce((s, i) => s + i.balance, 0),
            unpaidInvoices: processedInvoices.filter(i => i.status === 'Unpaid').length,
            partiallyPaidInvoices: processedInvoices.filter(i => i.status === 'Partially Paid').length,
            customerId
        };

        return reply.code(200).send({
            invoices: processedInvoices,
            summary
        });

    } catch (err) {
        console.error('Error fetching landlord unpaid invoices:', err);
        return reply.code(502).send({
            error: err.message,
            invoices: []
        });
    }
};

module.exports = get_landlord_unpaid_invoices;
