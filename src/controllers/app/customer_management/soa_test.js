const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const mongoose = require('mongoose');

const get_customer_statement_of_accounts = async (request, reply) => {
    try {
        const { facilityId, customerId } = request.params;

        console.log(`Facility ID: ${facilityId}, Customer ID: ${customerId}`);

        // Retrieve the Invoice model for the facility
        const invoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);

        // Get all invoices for the customer (both lease and contract types)
        const customerInvoices = await invoiceModel.find({
            'client.clientId': customerId
        }).lean();

        console.log(`Found ${customerInvoices.length} total invoices for customer ${customerId}`);

        // Initialize the statement array
        let statementEntries = [];

        // Process each invoice and payment into the statement entries array
        for (const invoice of customerInvoices) {
            const invoiceType = invoice.whatFor?.invoiceType || 'Unknown';
            const unitName = invoice.unit?.name || 'N/A';

            // Format details based on invoice type
            let details;
            if (invoiceType === 'Contract') {
                details = `(${unitName}) - Tenant - Levy Invoice`;
            } else if (invoiceType === 'Lease') {
                details = `(${unitName}) - Tenant - Lease Invoice`;
            } else {
                details = `(${unitName}) - ${invoiceType} Invoice`;
            }

            // Add invoice entry
            statementEntries.push({
                date: invoice.issueDate,
                transactionRef: invoice.invoiceNumber,
                details: details,
                invoiceType: invoiceType,
                debit: invoice.totalAmount,
                credit: 0,
                unitName: unitName,
                unitId: invoice.unit?.id || 'N/A',
                // Add a sortOrder property to ensure invoices appear before payments
                sortOrder: 1 // Lower number means it will appear first when sorted
            });

            // Process all payments in reconciliationHistory
            if (invoice.reconciliationHistory && invoice.reconciliationHistory.length > 0) {
                for (const payment of invoice.reconciliationHistory) {
                    if (payment.type === 'payment' || payment.type === 'cash') {
                        // Format payment details based on invoice type
                        let paymentDetails;
                        if (invoiceType === 'Contract') {
                            paymentDetails = `(${unitName}) - Levy - Levy Payment`;
                        } else if (invoiceType === 'Lease') {
                            paymentDetails = `(${unitName}) - Tenant - Lease Payment`;
                        } else {
                            paymentDetails = `(${unitName}) - ${invoiceType} Payment`;
                        }

                        statementEntries.push({
                            date: payment.date,
                            transactionRef: payment.paymentReference || 'Payment',
                            details: paymentDetails,
                            invoiceType: invoiceType,
                            debit: 0,
                            credit: payment.amount,
                            unitName: unitName,
                            unitId: invoice.unit?.id || 'N/A',
                            // Add a sortOrder property to ensure payments appear after invoices
                            sortOrder: 2 // Higher number means it will appear later when sorted
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
        runningBalance = 0; // reuse the already-declared variable
        statementEntries = statementEntries.map(entry => {
            runningBalance += (entry.debit || 0) - (entry.credit || 0);
            return { ...entry, balance: runningBalance };
        });

        // STEP 3: Reverse to show newest to oldest
        statementEntries.reverse();


        // Remove the sortOrder property as it's no longer needed in the response
        // statementEntries = statementEntries.map(entry => {
        //     const { sortOrder, ...entryWithoutSortOrder } = entry;
        //     return entryWithoutSortOrder;
        // });

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

        // Group transactions by unit for additional insight
        const unitSummaries = {};
        for (const entry of statementEntries) {
            if (!unitSummaries[entry.unitId]) {
                unitSummaries[entry.unitId] = {
                    unitId: entry.unitId,
                    unitName: entry.unitName,
                    totalDebits: 0,
                    totalCredits: 0,
                    balance: 0
                };
            }

            unitSummaries[entry.unitId].totalDebits += (entry.debit || 0);
            unitSummaries[entry.unitId].totalCredits += (entry.credit || 0);
            unitSummaries[entry.unitId].balance =
                unitSummaries[entry.unitId].totalDebits - unitSummaries[entry.unitId].totalCredits;
        }

        return reply.code(200).send({
            transactions: statementEntries,
            summary: summary,
            unitBreakdown: Object.values(unitSummaries)
        });
    } catch (err) {
        console.error('Error in get_customer_statement_of_accounts:', err);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_customer_statement_of_accounts;