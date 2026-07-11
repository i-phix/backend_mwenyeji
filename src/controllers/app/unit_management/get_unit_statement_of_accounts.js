const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const mongoose = require('mongoose');

// Add this helper function at the top of both files
const calculateAgingSummary = (invoices, statementDate = new Date()) => {
    const aging = {
        aging15: 0,
        aging30: 0,
        aging60: 0,
        aging90: 0,
        totalOutstanding: 0
    };

    const currentDate = new Date(statementDate);

    invoices.forEach(invoice => {
        // Skip voided invoices
        if (invoice.status === 'Void') {
            return;
        }

        const dueDate = new Date(invoice.dueDate);
        const daysOverdue = Math.floor((currentDate - dueDate) / (1000 * 60 * 60 * 24));

        // Calculate total payments from reconciliation history
        let totalPayments = 0;
        if (invoice.reconciliationHistory && invoice.reconciliationHistory.length > 0) {
            totalPayments = invoice.reconciliationHistory.reduce((sum, payment) => {
                // Only count valid payment types
                const validTypes = ['payment', 'cash', 'cheque', 'bank-transfer', 'mpesa-transfer'];
                if (validTypes.includes(payment.type)) {
                    return sum + (payment.amount || 0);
                }
                return sum;
            }, 0);
        }

        const outstandingBalance = invoice.totalAmount - totalPayments;

        console.log(`Invoice ${invoice.invoiceNumber || invoice._id}:`);
        console.log(`  Total: ${invoice.totalAmount}, Paid: ${totalPayments}, Outstanding: ${outstandingBalance}`);
        console.log(`  Due: ${dueDate}, Days Overdue: ${daysOverdue}`);

        // Include all invoices with outstanding balance, regardless of days overdue
        // This catches invoices that are exactly on due date but unpaid
        if (outstandingBalance > 0) {
            if (daysOverdue <= 15) {
                aging.aging15 += outstandingBalance;
            } else if (daysOverdue <= 30) {
                aging.aging30 += outstandingBalance;
            } else if (daysOverdue <= 60) {
                aging.aging60 += outstandingBalance;
            } else {
                aging.aging90 += outstandingBalance;
            }

            aging.totalOutstanding += outstandingBalance;
        }
    });

    console.log('Final Aging Summary:', aging);
    return aging;
};

const get_unit_statement_of_accounts = async (request, reply) => {
    try {
        const { facilityId, customerId, unitId } = request.params;
        const validPaymentTypes = [
            'payment',
            'cash',
            'cheque',
            'bank-transfer',
            'mpesa-transfer'
        ];

        // Initialize the statement array and invoices collection
        let statementEntries = [];
        let allInvoices = []; // Collect all invoices for aging calculation

        // Retrieve the Invoice model for the facility
        const invoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);

        // Check if customerId is valid
        const isValidCustomerId = customerId && customerId !== 'null' && customerId !== 'undefined';

        // Get all invoices for the customer (both lease and contract types) if customer ID is valid
        if (isValidCustomerId && unitId && mongoose.Types.ObjectId.isValid(unitId)) {
            const unitObjectId = new mongoose.Types.ObjectId(unitId);

            const customerInvoices = await invoiceModel.find({
                'client.clientId': customerId,
                'unit.id': unitObjectId  // ✅ ADDED: Filter by specific unit
            }).lean();

            // Add to allInvoices collection for aging calculation
            allInvoices = allInvoices.concat(customerInvoices);

            // Process each invoice and payment into the statement entries array
            for (const invoice of customerInvoices) {
                const invoiceType = invoice.whatFor?.invoiceType || 'Unknown';
                const unitName = invoice.unit?.name || 'N/A';
                const isVoided = invoice.status === 'Void';

                // Format details based on invoice type
                let details;
                if (invoiceType === 'Contract') {
                    details = `(${unitName}) - Tenant - ${invoice.items?.[0]?.description || 'Levy Invoice'}`;
                } else if (invoiceType === 'Lease') {
                    details = `(${unitName}) - Tenant - ${invoice.items?.[0]?.description || 'Lease Invoice'}`;
                } else {
                    details = `(${unitName}) - ${invoice.items?.[0]?.description || invoiceType + ' Invoice'}`;
                }

                // Add "VOIDED" prefix to details if invoice is voided
                if (isVoided) {
                    details = `VOIDED - ${details}`;
                }

                // Add invoice entry
                statementEntries.push({
                    _id: invoice._id,
                    date: invoice.issueDate,
                    transactionRef: invoice.invoiceNumber,
                    details: details,
                    invoiceType: invoiceType,
                    debit: isVoided ? 0 : invoice.totalAmount, // Set debit to 0 for voided invoices
                    credit: 0,
                    unitName: unitName,
                    unitId: invoice.unit?.id || 'N/A',
                    sortOrder: 1,
                    isVoided: isVoided,
                    originalAmount: invoice.totalAmount // Keep original amount for reference
                });

                // Process all payments in reconciliationHistory (only for non-voided invoices)
                if (!isVoided && invoice.reconciliationHistory && invoice.reconciliationHistory.length > 0) {
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
                                sortOrder: 2,
                                isVoided: false
                            });
                        }
                    }
                }
            }
        }

        /**
         * Fetch homeowner levy (Contract) invoices made for this unit
         */
        if (unitId && mongoose.Types.ObjectId.isValid(unitId)) {
            const unitObjectId = new mongoose.Types.ObjectId(unitId);

            // Modified query to handle null customerId properly
            const homeownerQuery = {
                'whatFor.invoiceType': 'Contract',
                'unit.id': unitObjectId
            };

            // Only add the customer exclusion if we have a valid customerId
            if (isValidCustomerId) {
                homeownerQuery['client.clientId'] = { $ne: customerId };
            }

            const homeownerLevyInvoices = await invoiceModel.find(homeownerQuery).lean();

            // Add to allInvoices collection for aging calculation
            allInvoices = allInvoices.concat(homeownerLevyInvoices);

            for (const invoice of homeownerLevyInvoices) {
                const unitName = invoice.unit?.name || 'N/A';
                const isVoided = invoice.status === 'Void';

                let details = `(${unitName}) - HomeOwner - ${invoice.items?.[0]?.description || 'Levy Invoice'}`;
                if (isVoided) {
                    details = `VOIDED - ${details}`;
                }

                // Add levy invoice entry from homeowner
                statementEntries.push({
                    _id: invoice._id,
                    date: invoice.issueDate,
                    transactionRef: invoice.invoiceNumber,
                    details: details,
                    invoiceType: 'Contract',
                    debit: isVoided ? 0 : invoice.totalAmount, // Set debit to 0 for voided invoices
                    credit: 0,
                    unitName: unitName,
                    unitId: invoice.unit?.id || 'N/A',
                    sortOrder: 1,
                    isVoided: isVoided,
                    originalAmount: invoice.totalAmount // Keep original amount for reference
                });

                // Add any levy payments made by homeowner (only for non-voided invoices)
                if (!isVoided && invoice.reconciliationHistory && invoice.reconciliationHistory.length > 0) {
                    for (const payment of invoice.reconciliationHistory) {
                        if (validPaymentTypes.includes(payment.type)) {
                            statementEntries.push({
                                _id: invoice._id,
                                date: payment.date,
                                transactionRef: payment.paymentReference || 'Payment',
                                details: `(${unitName}) - Levy - ${invoice.items?.[0]?.description || 'Levy Payment'}`,
                                invoiceType: 'Contract',
                                debit: 0,
                                credit: payment.amount,
                                unitName: unitName,
                                unitId: invoice.unit?.id || 'N/A',
                                sortOrder: 2,
                                isVoided: false
                            });
                        }
                    }
                }
            }
        }

        // If there are no transaction entries, return an empty result
        if (statementEntries.length === 0) {
            return reply.code(200).send({
                transactions: [],
                summary: {
                    totalDebits: 0,
                    totalCredits: 0,
                    currentBalance: 0,
                    totalLeaseAmount: 0,
                    totalContractAmount: 0,
                    customerId: customerId
                },
                unitBreakdown: [],
                agingSummary: {
                    aging15: 0,
                    aging30: 0,
                    aging60: 0,
                    aging90: 0,
                    totalOutstanding: 0
                }
            });
        }

        // STEP 1: Sort by date (oldest to newest), then by sortOrder (invoices before payments)
        statementEntries.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);

            if (dateA < dateB) return -1;
            if (dateA > dateB) return 1;

            return a.sortOrder - b.sortOrder;
        });

        // STEP 2: Recalculate running balance (excluding voided invoices)
        let runningBalance = 0;
        statementEntries = statementEntries.map(entry => {
            // Only include non-voided transactions in running balance calculation
            if (!entry.isVoided) {
                runningBalance += (entry.debit || 0) - (entry.credit || 0);
            }
            return { ...entry, balance: runningBalance };
        });

        // Calculate summary information (excluding voided invoices)
        const summary = {
            totalDebits: statementEntries
                .filter(entry => !entry.isVoided)
                .reduce((sum, entry) => sum + (entry.debit || 0), 0),
            totalCredits: statementEntries
                .filter(entry => !entry.isVoided)
                .reduce((sum, entry) => sum + (entry.credit || 0), 0),
            currentBalance: runningBalance,
            totalLeaseAmount: statementEntries
                .filter(entry => entry.invoiceType === 'Lease' && entry.debit > 0 && !entry.isVoided)
                .reduce((sum, entry) => sum + entry.debit, 0),
            totalContractAmount: statementEntries
                .filter(entry => entry.invoiceType === 'Contract' && entry.debit > 0 && !entry.isVoided)
                .reduce((sum, entry) => sum + entry.debit, 0),
            customerId: customerId
        };

        // Group transactions by unit for additional insight (excluding voided invoices)
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

            // Only include non-voided transactions in unit summaries
            if (!entry.isVoided) {
                unitSummaries[entry.unitId].totalDebits += (entry.debit || 0);
                unitSummaries[entry.unitId].totalCredits += (entry.credit || 0);
                unitSummaries[entry.unitId].balance =
                    unitSummaries[entry.unitId].totalDebits - unitSummaries[entry.unitId].totalCredits;
            }
        }

        // Calculate aging summary using all collected invoices
        const agingSummary = calculateAgingSummary(allInvoices);

        return reply.code(200).send({
            transactions: statementEntries,
            summary: summary,
            unitBreakdown: Object.values(unitSummaries),
            agingSummary: agingSummary
        });
    } catch (err) {
        console.error('Error in get_unit_statement_of_accounts:', err);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_unit_statement_of_accounts;