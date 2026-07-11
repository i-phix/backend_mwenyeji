const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const mongoose = require('mongoose');

const get_statement_of_accounts = async (request, reply) => {
    try {
        const { tenantId, facilityId, homeOwnerId, unitId } = request.params;
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

        const unitObjectId = new mongoose.Types.ObjectId(unitId);

        // Get tenant lease invoices for the specific unit
        const tenantInvoices = await invoiceModel.find({
            'client.clientId': tenantId,
            'whatFor.invoiceType': 'Lease',
            'unit.id': unitObjectId  // Filter by the specific unit ID
        }).lean();

        // Get homeowner's levy/contract invoices for the specific unit
        const homeownerInvoices = await invoiceModel.find({
            'client.clientId': homeOwnerId,
            'whatFor.invoiceType': 'Contract',
            'unit.id': unitObjectId  // Filter by the specific unit ID
        }).lean();

        // Combine the filtered invoices
        const allInvoices = [...tenantInvoices, ...homeownerInvoices];

        // Initialize the statement array
        let statementEntries = [];
        let runningBalance = 0;

        // Process each invoice
        for (const invoice of allInvoices) {
            const invoiceType = invoice.whatFor?.invoiceType || 'Unknown';
            const unitName = invoice.unit?.name || 'N/A';

            // Determine if this is a tenant or homeowner invoice
            const isTenantInvoice = invoice.client.clientId.toString() === tenantId;

            // Format details based on invoice type and ownership
            let details;
            if (isTenantInvoice) {
                details = `(${unitName}) - Tenant - ${invoice.items?.[0]?.description || 'Lease Invoice'}`;
            } else {
                details = `(${unitName}) - HomeOwner - ${invoice.items?.[0]?.description || 'Levy Invoice'}`;
            }

            // Add invoice entry
            statementEntries.push({
                date: invoice.issueDate,
                transactionRef: invoice.invoiceNumber,
                details: details,
                invoiceType: invoiceType,
                isTenantTransaction: isTenantInvoice,
                debit: invoice.totalAmount,
                credit: 0,
                balance: runningBalance + invoice.totalAmount,
                unitName: unitName,
                sortOrder: 1 // Add sortOrder to ensure invoices appear before payments
            });
            runningBalance += invoice.totalAmount;

            // Process all payments in reconciliationHistory
            if (invoice.reconciliationHistory && invoice.reconciliationHistory.length > 0) {
                for (const payment of invoice.reconciliationHistory) {
                    if (validPaymentTypes.includes(payment.type)) {
                        // Format payment details based on invoice type and ownership
                        let paymentDetails;
                        if (isTenantInvoice) {
                            paymentDetails = `(${unitName}) - Tenant - ${invoice.items?.[0]?.description || 'Lease Payment'}`;
                        } else {
                            paymentDetails = `(${unitName}) - HomeOwner - ${invoice.items?.[0]?.description || 'Levy Payment'}`;
                        }

                        statementEntries.push({
                            date: payment.date,
                            transactionRef: payment.paymentReference || 'Payment',
                            details: paymentDetails,
                            invoiceType: invoiceType,
                            isTenantTransaction: isTenantInvoice,
                            debit: 0,
                            credit: payment.amount,
                            balance: runningBalance - payment.amount,
                            unitName: unitName,
                            sortOrder: 2 // Add sortOrder to ensure payments appear after invoices
                        });
                        runningBalance -= payment.amount;
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



        // Calculate summary information
        const summary = {
            totalDebits: statementEntries.reduce((sum, entry) => sum + (entry.debit || 0), 0),
            totalCredits: statementEntries.reduce((sum, entry) => sum + (entry.credit || 0), 0),
            currentBalance: runningBalance,
            totalLeaseAmount: statementEntries
                .filter(entry => entry.invoiceType === 'Lease' && entry.debit > 0)
                .reduce((sum, entry) => sum + entry.debit, 0),
            totalLevyAmount: statementEntries
                .filter(entry => entry.invoiceType === 'Contract' && entry.debit > 0)
                .reduce((sum, entry) => sum + entry.debit, 0),
            unitId: unitId,
            unitName: statementEntries.length > 0 ? statementEntries[0].unitName : 'N/A'
        };

        return reply.code(200).send({
            transactions: statementEntries,
            summary: summary
        });
    } catch (err) {
        console.error('Error in get_statement_of_accounts:', err);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_statement_of_accounts;