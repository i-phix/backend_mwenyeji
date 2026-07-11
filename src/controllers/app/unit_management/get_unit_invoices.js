const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const mongoose = require('mongoose');

const get_unit_invoices = async (request, reply) => {
    try {
        const { facilityId, unitId } = request.params;

        if (!unitId || !mongoose.Types.ObjectId.isValid(unitId)) {
            return reply.code(400).send({
                error: 'Valid unitId is required',
                invoices: []
            });
        }

        const invoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);
        const unitObjectId = new mongoose.Types.ObjectId(unitId);

        const unitInvoices = await invoiceModel.find({
            'unit.id': unitObjectId
        }).lean();

        if (unitInvoices.length === 0) {
            return reply.code(200).send({
                invoices: [],
                summary: {
                    totalInvoices: 0,
                    totalAmount: 0,
                    totalAmountPaid: 0,
                    totalBalance: 0,
                    unitId: unitId
                }
            });
        }

        const processedInvoices = unitInvoices.map(invoice => {
            // Extract item description (first item)
            const itemDescription = invoice.items?.[0]?.description || null;

            // Get the whatFor invoice type
            const whatForInvoiceType = invoice.whatFor?.invoiceType || 'Unknown';

            // Fallback: Extract invoiceType with mapping
            let fallbackInvoiceType = whatForInvoiceType;
            if (fallbackInvoiceType === 'Contract') fallbackInvoiceType = 'Levy Invoice';
            if (fallbackInvoiceType === 'Lease') fallbackInvoiceType = 'Lease Invoice';

            const invoiceType = itemDescription || fallbackInvoiceType;

            const unitName = invoice.unit?.name || 'N/A';
            const clientName = `${invoice.client?.firstName || ''} ${invoice.client?.lastName || ''}`.trim() || 'N/A';

            const isVoided = invoice.status === 'Void';

            const totalPaid = isVoided ? 0 : invoice.amountPaid || 0;

            const payments = Array.isArray(invoice.reconciliationHistory)
                ? invoice.reconciliationHistory.map(payment => ({
                    date: payment.date,
                    amount: payment.amount,
                    type: payment.type,
                    paymentReference: payment.paymentReference,
                    paymentMethod: payment.paymentDetails?.paymentMethod || payment.type,
                    notes: payment.notes
                }))
                : [];

            const balance = isVoided ? 0 : (invoice.totalAmount || 0) - totalPaid;
            const totalAmount = isVoided ? 0 : invoice.totalAmount || 0;

            // ❗ Use actual invoice.status from DB
            const status = invoice.status;

            return {
                _id: invoice._id,
                invoiceNumber: invoice.invoiceNumber,
                invoiceType,
                whatFor: whatForInvoiceType,
                unitName,
                unitId: invoice.unit?.id,
                clientName,
                clientId: invoice.client?.clientId,
                issueDate: invoice.issueDate,
                dueDate: invoice.dueDate,
                totalAmount,
                amountPaid: totalPaid,
                balance,
                status,
                currency: invoice.currency,
                accountNumber: invoice.accountNumber,
                payments,
                paymentCount: payments.length,
                invoiceUrl: invoice.invoiceUrl,
                createdAt: invoice.createdAt,
                updatedAt: invoice.updatedAt
            };
        });


        processedInvoices.sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate));

        const summary = {
            totalInvoices: processedInvoices.length,
            totalAmount: processedInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
            totalAmountPaid: processedInvoices.reduce((sum, inv) => sum + inv.amountPaid, 0),
            totalBalance: processedInvoices.reduce((sum, inv) => sum + inv.balance, 0),
            paidInvoices: processedInvoices.filter(inv => inv.status === 'Paid').length,
            partiallyPaidInvoices: processedInvoices.filter(inv => inv.status === 'Partially Paid').length,
            unpaidInvoices: processedInvoices.filter(inv => inv.status === 'Unpaid').length,
            unitId
        };

        const invoiceTypeBreakdown = {};
        processedInvoices.forEach(invoice => {
            if (!invoiceTypeBreakdown[invoice.invoiceType]) {
                invoiceTypeBreakdown[invoice.invoiceType] = {
                    invoiceType: invoice.invoiceType,
                    whatFor: invoice.whatFor,
                    count: 0,
                    totalAmount: 0,
                    totalPaid: 0,
                    totalBalance: 0
                };
            }

            invoiceTypeBreakdown[invoice.invoiceType].count++;
            invoiceTypeBreakdown[invoice.invoiceType].totalAmount += invoice.totalAmount;
            invoiceTypeBreakdown[invoice.invoiceType].totalPaid += invoice.amountPaid;
            invoiceTypeBreakdown[invoice.invoiceType].totalBalance += invoice.balance;
        });

        return reply.code(200).send({
            invoices: processedInvoices,
            summary,
            invoiceTypeBreakdown: Object.values(invoiceTypeBreakdown)
        });

    } catch (err) {
        console.error('Error in get_unit_invoices:', err);
        return reply.code(502).send({
            error: err.message,
            invoices: []
        });
    }
};

module.exports = get_unit_invoices;
