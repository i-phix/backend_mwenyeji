const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const mongoose = require('mongoose');

const get_customer_statement_of_accounts = async (request, reply) => {
    try {
        const { facilityId, customerId } = request.params;
        const validPaymentTypes = [
            'payment',
            'cash',
            'cheque',
            'bank-transfer',
            'mpesa-transfer',
            'overpay-transfer',
            'balance-deduction',
            'overpay-received',
            'credit-forward',
            'debit-forward'
        ];

        // Retrieve the Invoice model for the facility
        const invoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);

        // Get all invoices for the customer (both lease and contract types)
        const customerInvoices = await invoiceModel.find({
            'client.clientId': customerId
        }).lean();


        // Initialize the statement array
        let statementEntries = [];

        // Process each invoice and payment into the statement entries array
        for (const invoice of customerInvoices) {
            const invoiceType = invoice.whatFor?.invoiceType || 'Unknown';
            const unitName = invoice.unit?.name || 'N/A';

            // Format details based on invoice type
            let details;
            if (invoiceType === 'Contract') {
                details = `(${unitName}) - Tenant - ${invoice.items?.[0]?.description || 'Levy Invoice'}`;
            } else if (invoiceType === 'Lease') {
                details = `(${unitName}) - Tenant - ${invoice.items?.[0]?.description || 'Lease Invoice'}`;
            } else {
                details = `(${unitName}) - ${invoice.items?.[0]?.description || invoiceType + ' Invoice'}`;
            }

            // Add invoice entry
            statementEntries.push({
                _id: invoice._id,
                date: invoice.issueDate,
                transactionRef: invoice.invoiceNumber,
                details: details,
                invoiceType: invoiceType,
                debit: invoice.totalAmount,
                credit: 0,
                unitName: unitName,
                unitId: invoice.unit?.id || 'N/A',
                sortOrder: 1
            });

            // Process all payments in reconciliationHistory
            if (invoice.reconciliationHistory && invoice.reconciliationHistory.length > 0) {
                for (const payment of invoice.reconciliationHistory) {
                    if (validPaymentTypes.includes(payment.type)) {
                        let paymentDetails;
                        if (invoiceType === 'Contract') {
                            paymentDetails = `(${unitName}) - Levy - ${invoice.items?.[0]?.description || 'Levy Payment'}`;
                        } else if (invoiceType === 'Lease') {
                            paymentDetails = `(${unitName}) - Tenant - ${invoice.items?.[0]?.description || 'Lease Payment'}`;
                        } else {
                            paymentDetails = `(${unitName}) - ${invoice.items?.[0]?.description || invoiceType + ' Payment'}`;
                        }

                        statementEntries.push({
                            _id: invoice._id,
                            date: payment.date,
                            transactionRef: payment.paymentReference || 'Payment',
                            details: paymentDetails,
                            invoiceType: invoiceType,
                            debit: 0,
                            credit: payment.amount,
                            unitName: unitName,
                            unitId: invoice.unit?.id || 'N/A',
                            sortOrder: 2
                        });
                    }
                }
            }
        }

        // STEP 1: Sort by date (oldest to newest), then by sortOrder (invoices before payments)
        statementEntries.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);

            if (dateA < dateB) return -1;
            if (dateA > dateB) return 1;

            return a.sortOrder - b.sortOrder;
        });

        // STEP 2: Recalculate running balance
        let runningBalance = 0;
        statementEntries = statementEntries.map(entry => {
            runningBalance += (entry.debit || 0) - (entry.credit || 0);
            return { ...entry, balance: runningBalance };
        });
    

        // Calculate summary information
        const summary = {
            totalDebits: statementEntries.reduce((sum, entry) => sum + (entry.debit || 0), 0),
            totalCredits: statementEntries.reduce((sum, entry) => sum + (entry.credit || 0), 0),
            currentBalance: runningBalance,
            totalLeaseAmount: statementEntries
                .filter(entry => entry.invoiceType === 'Lease' && entry.debit > 0)
                .reduce((sum, entry) => sum + entry.debit, 0),
            totalContractAmount: statementEntries
                .filter(entry => entry.invoiceType === 'Contract' && entry.debit > 0)
                .reduce((sum, entry) => sum + entry.debit, 0),
            customerId: customerId
        };


        return reply.code(200).send({
            transactions: statementEntries,
            summary: summary,
            // unitBreakdown: Object.values(unitSummaries)
        });
    } catch (err) {
        console.error('Error in get_customer_statement_of_accounts:', err);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_customer_statement_of_accounts;
