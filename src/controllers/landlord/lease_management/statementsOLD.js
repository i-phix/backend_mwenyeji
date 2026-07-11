const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_statement_of_accounts = async (request, reply) => {
    try {
        const { customerId, facilityId } = request.params;

        // Retrieve the Invoice model for the facility
        const invoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);

        // Fetch all invoices for this customer
        const invoices = await invoiceModel.find({ 'client.clientId': customerId });

        // Initialize the statement array
        let statementEntries = [];
        let runningBalance = 0;

        // Process each invoice
        for (const invoice of invoices) {
            // Add invoice entry
            statementEntries.push({
                date: invoice.issueDate,
                transactionRef: invoice.invoiceNumber,
                details: `Invoice: ${invoice.whatFor?.description}`,
                debit: invoice.totalAmount,
                credit: 0,
                balance: runningBalance + invoice.totalAmount
            });

            runningBalance += invoice.totalAmount;

            // Process all payments in reconciliationHistory
            if (invoice.reconciliationHistory && invoice.reconciliationHistory.length > 0) {
                for (const payment of invoice.reconciliationHistory) {
                    if (payment.type === 'payment') {
                        statementEntries.push({
                            date: payment.date,
                            transactionRef: payment.paymentReference,
                            details: payment.notes || `Payment: ${payment.paymentCompletion}`,
                            debit: 0,
                            credit: payment.amount,
                            balance: runningBalance - payment.amount
                        });

                        runningBalance -= payment.amount;
                    }
                }
            }
        }

        // Sort by date
        statementEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

        return reply.code(200).send(statementEntries);
    } catch (err) {
        console.error('Error in get_statement_of_accounts:', err);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_statement_of_accounts;