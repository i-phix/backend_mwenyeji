// controllers/app/payment_management/getInvoiceReconciliation.js
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const mongoose = require('mongoose');

/**
 * Handler for getting invoices cleared by a payment
 * This endpoint retrieves all invoices that were affected by a specific payment
 * @param {FastifyRequest} request - The Fastify request object
 * @param {FastifyReply} reply - The Fastify reply object
 * @returns {Promise<Object>} Response containing the cleared invoices data
 */
const get_invoice_reconciliation = async (request, reply) => {
    console.log('=== Start: getInvoiceReconciliation ===');
    console.log(`Request params: ${JSON.stringify(request.params)}`);
    console.log(`Request query: ${JSON.stringify(request.query)}`);
    
    try {
        const { facilityId } = request.params;
        const { paymentReference, sourceInvoice, sourceType } = request.query;
        
        // Validate required parameters
        if (!facilityId) {
            console.log('Error: Missing facilityId parameter');
            return reply.code(400).send({
                success: false,
                error: 'Missing facilityId parameter'
            });
        }

        if (!paymentReference) {
            console.log('Error: Missing paymentReference parameter');
            return reply.code(400).send({
                success: false,
                error: 'Missing paymentReference query parameter'
            });
        }

        // Check if facilityId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(facilityId)) {
            console.log('Error: Invalid facilityId format');
            return reply.code(400).send({
                success: false,
                error: 'Invalid facilityId format'
            });
        }

        // Get the Invoice model based on the facility ID
        const Invoice = await getModel("Invoice", payservedb.Invoice.schema, facilityId);
        const VasInvoice = await getModel("VasInvoice", payservedb.VasInvoice.schema, facilityId);
        const WaterInvoice = await getModel("WaterInvoice", payservedb.WaterInvoice.schema, facilityId);
        
        // First, find the source invoice to get reconciliation history
        console.log(`Searching for source invoice: ${sourceInvoice}`);
        let sourceInvoiceDoc;
        
        if (sourceInvoice) {
            // Try to find the invoice in all collections
            const [regularInvoice, vasInvoice, waterInvoice] = await Promise.all([
                Invoice.findOne({ invoiceNumber: sourceInvoice }).lean(),
                VasInvoice.findOne({ invoiceNumber: sourceInvoice }).lean(),
                WaterInvoice.findOne({ invoiceNumber: sourceInvoice }).lean()
            ]);
            
            sourceInvoiceDoc = regularInvoice || vasInvoice || waterInvoice;
        } else {
            // If no source invoice provided, try to find by payment reference in reconciliation history
            console.log(`Searching for invoice with payment reference: ${paymentReference}`);
            const [regularInvoice, vasInvoice, waterInvoice] = await Promise.all([
                Invoice.findOne({ 'reconciliationHistory.paymentReference': paymentReference }).lean(),
                VasInvoice.findOne({ 'reconciliationHistory.paymentReference': paymentReference }).lean(),
                WaterInvoice.findOne({ 'reconciliationHistory.paymentReference': paymentReference }).lean()
            ]);
            
            sourceInvoiceDoc = regularInvoice || vasInvoice || waterInvoice;
        }

        if (!sourceInvoiceDoc) {
            console.log('Error: Source invoice not found');
            return reply.code(404).send({
                success: false,
                error: 'Source invoice not found'
            });
        }

        console.log(`Found source invoice: ${sourceInvoiceDoc.invoiceNumber}`);

        // Extract reconciliation entries for this payment reference
        const reconciliationEntries = sourceInvoiceDoc.reconciliationHistory?.filter(entry => 
            entry.paymentReference === paymentReference || 
            entry.transactionId === paymentReference
        ) || [];

        console.log(`Found ${reconciliationEntries.length} reconciliation entries for payment reference: ${paymentReference}`);

        // Find all destination invoices mentioned in reconciliation history
        const destinationInvoiceAccounts = reconciliationEntries
            .filter(entry => entry.destinationInvoice)
            .map(entry => entry.destinationInvoice);

        // Find all source invoices mentioned in reconciliation history (from other invoices)
        const sourceReferences = [
            sourceInvoiceDoc.invoiceNumber,
            sourceInvoiceDoc.accountNumber
        ].filter(Boolean);

        // Create a query to find all affected invoices
        const query = {
            $or: [
                // Invoices directly affected by this payment
                { 'reconciliationHistory.paymentReference': paymentReference },
                // Invoices that are destinations in the reconciliation history
                { accountNumber: { $in: destinationInvoiceAccounts } },
                // Invoices that reference this source invoice
                { 'reconciliationHistory.sourceInvoice': { $in: sourceReferences } },
                // The source invoice itself
                { _id: sourceInvoiceDoc._id }
            ]
        };

        console.log(`Executing query to find affected invoices: ${JSON.stringify(query)}`);
        
        // Find affected invoices in all collections
        const [regularInvoices, vasInvoices, waterInvoices] = await Promise.all([
            Invoice.find(query).lean(),
            VasInvoice.find(query).lean(),
            WaterInvoice.find(query).lean()
        ]);
        
        // Combine results from all invoice types
        const affectedInvoices = [
            ...regularInvoices,
            ...vasInvoices,
            ...waterInvoices
        ];
        
        console.log(`Found ${affectedInvoices.length} affected invoices`);

        // For each invoice, find the relevant reconciliation entries
        const clearedInvoices = affectedInvoices.map(invoice => {
            // Find entries in this invoice that match our payment reference
            const relevantEntries = invoice.reconciliationHistory?.filter(entry => 
                entry.paymentReference === paymentReference || 
                entry.transactionId === paymentReference ||
                (entry.sourceInvoice && sourceReferences.includes(entry.sourceInvoice)) ||
                (entry.destinationInvoice && sourceReferences.includes(entry.destinationInvoice))
            ) || [];

            // Calculate the amount applied to this invoice from this payment
            const appliedAmount = relevantEntries.reduce((sum, entry) => {
                // Only count entries that apply payment to this invoice (not transfers out)
                if (['payment', 'credit-received', 'overpay-received'].includes(entry.type)) {
                    return sum + (entry.amount || 0);
                }
                return sum;
            }, 0);

            // Get the latest entry to determine remaining balance at time of payment
            const latestEntry = relevantEntries.sort((a, b) => 
                new Date(b.date) - new Date(a.date)
            )[0];

            return {
                invoiceId: invoice._id,
                invoiceNumber: invoice.invoiceNumber,
                accountNumber: invoice.accountNumber,
                issueDate: invoice.issueDate,
                dueDate: invoice.dueDate,
                totalAmount: invoice.totalAmount,
                amountPaid: appliedAmount,
                remainingBalance: latestEntry?.remainingBalance || 0,
                status: invoice.status,
                currency: invoice.currency,
                client: invoice.client,
                reconciliationEntries: relevantEntries
            };
        });

        // Calculate totals
        const totalApplied = clearedInvoices.reduce((sum, invoice) => sum + (invoice.amountPaid || 0), 0);
        
        console.log(`Total applied amount: ${totalApplied}`);
        console.log(`Returning ${clearedInvoices.length} cleared invoices`);

        return reply.code(200).send({
            success: true,
            paymentReference,
            sourceInvoice: sourceInvoiceDoc.invoiceNumber,
            totalApplied,
            invoices: clearedInvoices
        });

    } catch (error) {
        console.error('Error in getInvoiceReconciliation:', error);
        console.error('Error stack:', error.stack);
        return reply.code(500).send({
            success: false,
            error: error.message || 'Internal server error'
        });
    } finally {
        console.log('=== End: getInvoiceReconciliation ===');
    }
};

module.exports = get_invoice_reconciliation;