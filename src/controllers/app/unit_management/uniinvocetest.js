const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const mongoose = require('mongoose');

const get_unit_invoices = async (request, reply) => {
    try {
        const { facilityId, unitId } = request.params;

        // Check if unitId is valid
        if (!unitId || !mongoose.Types.ObjectId.isValid(unitId)) {
            return reply.code(400).send({
                error: 'Valid unitId is required',
                invoices: []
            });
        }

        // Retrieve the Invoice model for the facility
        const invoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);

        const unitObjectId = new mongoose.Types.ObjectId(unitId);

        // Get all invoices for the unit
        const unitInvoices = await invoiceModel.find({
            'unit.id': unitObjectId
        }).lean();

        // If no invoices found, return empty result
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

        // Process each invoice to create the datatable format
        const processedInvoices = unitInvoices.map(invoice => {
            let invoiceType = invoice.whatFor?.invoiceType || 'Unknown';
            if (invoiceType === 'Contract') {
                invoiceType = 'Levy Invoice';
            }
            if (invoiceType === 'Lease') {
                invoiceType = 'Lease Invoice';
            }
            const unitName = invoice.unit?.name || 'N/A';
            const clientName = `${invoice.client?.firstName || ''} ${invoice.client?.lastName || ''}`.trim() || 'N/A';

            // Calculate total payments from reconciliation history
            let totalPaid = 0;
            const payments = [];

            if (invoice.reconciliationHistory && invoice.reconciliationHistory.length > 0) {
                invoice.reconciliationHistory.forEach(payment => {
                    if (payment.type === 'payment' || payment.type === 'cash') {
                        totalPaid += payment.amount || 0;
                        payments.push({
                            date: payment.date,
                            amount: payment.amount,
                            type: payment.type,
                            paymentReference: payment.paymentReference,
                            paymentMethod: payment.paymentDetails?.paymentMethod || payment.type,
                            notes: payment.notes
                        });
                    }
                });
            }

            // Calculate balance
            const balance = (invoice.totalAmount || 0) - totalPaid;

            // Determine status
            let status;
            if (balance <= 0) {
                status = 'Paid';
            } else if (totalPaid > 0) {
                status = 'Partially Paid';
            } else {
                status = 'Unpaid';
            }

            return {
                _id: invoice._id,
                invoiceNumber: invoice.invoiceNumber,
                invoiceType: invoiceType,
                unitName: unitName,
                unitId: invoice.unit?.id,
                clientName: clientName,
                clientId: invoice.client?.clientId,
                issueDate: invoice.issueDate,
                dueDate: invoice.dueDate,
                totalAmount: invoice.totalAmount || 0,
                amountPaid: totalPaid,
                balance: balance,
                status: status,
                currency: invoice.currency,
                accountNumber: invoice.accountNumber,
                payments: payments, // Array of individual payments
                paymentCount: payments.length,
                invoiceUrl: invoice.invoiceUrl,
                createdAt: invoice.createdAt,
                updatedAt: invoice.updatedAt
            };
        });

        // Sort by issue date (newest first)
        processedInvoices.sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate));

        // Calculate summary
        const summary = {
            totalInvoices: processedInvoices.length,
            totalAmount: processedInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
            totalAmountPaid: processedInvoices.reduce((sum, inv) => sum + inv.amountPaid, 0),
            totalBalance: processedInvoices.reduce((sum, inv) => sum + inv.balance, 0),
            paidInvoices: processedInvoices.filter(inv => inv.status === 'Paid').length,
            partiallyPaidInvoices: processedInvoices.filter(inv => inv.status === 'Partially Paid').length,
            unpaidInvoices: processedInvoices.filter(inv => inv.status === 'Unpaid').length,
            unitId: unitId
        };

        // Group by invoice type for additional insights
        const invoiceTypeBreakdown = {};
        processedInvoices.forEach(invoice => {
            if (!invoiceTypeBreakdown[invoice.invoiceType]) {
                invoiceTypeBreakdown[invoice.invoiceType] = {
                    invoiceType: invoice.invoiceType,
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
            summary: summary,
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