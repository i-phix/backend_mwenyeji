const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const mongoose = require('mongoose');

/**
 * Helper function to determine invoice status based on payment and balance information
 * Status is calculated based on the current effective balance, not the stored balanceBroughtForward
 * 
 * @param {Number} amountPaid - The amount already paid on the invoice
 * @param {Number} totalAmount - The total amount of the invoice
 * @param {Date|String} dueDate - The due date of the invoice
 * @param {Number} balanceBroughtForward - The balance brought forward (can be negative for credit)
 * @returns {String} The determined invoice status
 */
const determineInvoiceStatus = (amountPaid, totalAmount, dueDate, balanceBroughtForward = 0) => {
    console.log(`Determining invoice status - amountPaid: ${amountPaid}, totalAmount: ${totalAmount}, dueDate: ${dueDate}, balanceBroughtForward: ${balanceBroughtForward}`);

    // Calculate total owed including any brought forward balance
    const totalOwed = totalAmount + (balanceBroughtForward > 0 ? balanceBroughtForward : 0);

    // Calculate effective balance considering credits
    const effectiveBalance = totalOwed - amountPaid - (balanceBroughtForward < 0 ? Math.abs(balanceBroughtForward) : 0);

    console.log(`Status calculation - totalOwed: ${totalOwed}, effectiveBalance: ${effectiveBalance}`);

    let status;
    if (effectiveBalance <= 0) status = 'Paid';
    else if (effectiveBalance > 0 && effectiveBalance < totalOwed) status = 'Partially Paid';
    else if (dueDate && new Date() > new Date(dueDate)) status = 'Overdue';
    else status = 'Unpaid';

    console.log(`Determined status: ${status}`);
    return status;
};

/**
 * Calculate the current balance for an invoice without modifying the stored balanceBroughtForward
 * Positive balance = amount owed (displayed in red)
 * Negative balance = credit (displayed in green with minus sign)
 * 
 * @param {Object} invoice - The invoice object
 * @returns {Number} The calculated balance (negative for credit, positive for amount owed)
 */
const calculateBalance = (invoice) => {
    // Calculate total amount due including stored balanceBroughtForward
    const totalAmountDue = invoice.totalAmount + (invoice.balanceBroughtForward > 0 ? invoice.balanceBroughtForward : 0);

    // Calculate total payments including any applied credit (negative balanceBroughtForward)
    const totalPayments = invoice.amountPaid || 0;
    const creditApplied = invoice.balanceBroughtForward < 0 ? Math.abs(invoice.balanceBroughtForward) : 0;

    // Final balance = what's owed minus what's paid (including credits)
    const calculatedBalance = totalAmountDue - totalPayments - creditApplied;

    console.log(`Calculated balance - totalAmount: ${invoice.totalAmount}, balanceBroughtForward: ${invoice.balanceBroughtForward}, amountPaid: ${invoice.amountPaid}, calculatedBalance: ${calculatedBalance}`);

    return calculatedBalance;
};

// Get the appropriate model based on the invoice ID
const getInvoiceModelById = async (facilityId, invoiceId) => {
    console.log(`Finding invoice model for facilityId: ${facilityId}, invoiceId: ${invoiceId}`);

    try {
        // Get models from different collections
        console.log('Fetching database models...');
        const Invoice = await getModel("Invoice", payservedb.Invoice.schema, facilityId);
        const VasInvoice = await getModel("VasInvoice", payservedb.VasInvoice.schema, facilityId);
        const WaterInvoice = await getModel("WaterInvoice", payservedb.WaterInvoice.schema, facilityId);
        console.log('Database models fetched successfully');

        // Try to find the invoice in each model
        console.log(`Searching for invoice ${invoiceId} across all collections...`);
        const [regularInvoice, vasInvoice, waterInvoice] = await Promise.all([
            Invoice.findById(invoiceId),
            VasInvoice.findById(invoiceId),
            WaterInvoice.findById(invoiceId)
        ]);

        console.log(`Search results - Regular: ${!!regularInvoice}, VAS: ${!!vasInvoice}, Water: ${!!waterInvoice}`);

        if (regularInvoice) {
            console.log(`Found invoice in Regular collection with invoice number: ${regularInvoice.invoiceNumber}`);
            return { model: Invoice, type: 'regular', invoice: regularInvoice };
        }

        if (vasInvoice) {
            console.log(`Found invoice in VAS collection with invoice number: ${vasInvoice.invoiceNumber}`);
            return { model: VasInvoice, type: 'vas', invoice: vasInvoice };
        }

        if (waterInvoice) {
            console.log(`Found invoice in Water collection with invoice number: ${waterInvoice.invoiceNumber}`);
            return { model: WaterInvoice, type: 'water', invoice: waterInvoice };
        }

        console.log(`Invoice ${invoiceId} not found in any collection`);
        throw new Error('Invoice not found in any collection');
    } catch (error) {
        console.error(`Error in getInvoiceModelById: ${error.message}`);
        console.error('Error stack:', error.stack);
        throw error;
    }
};

const apply_overpayment = async (request, reply) => {
    console.log('=== Start: apply_overpayment ===');
    console.log(`Request params: ${JSON.stringify(request.params)}`);
    console.log(`Request body: ${JSON.stringify(request.body)}`);

    try {
        const { facilityId } = request.params;
        const { sourceInvoiceId, selectedInvoices, overpaymentAmount } = request.body;

        console.log(`Processing request - facilityId: ${facilityId}, sourceInvoiceId: ${sourceInvoiceId}, overpaymentAmount: ${overpaymentAmount}`);
        console.log(`Selected invoices (${selectedInvoices?.length}): ${JSON.stringify(selectedInvoices)}`);

        // Validate required parameters
        if (!facilityId || !sourceInvoiceId || !selectedInvoices || !overpaymentAmount) {
            console.log('Error: Missing required parameters');
            return reply.code(400).send({
                success: false,
                error: 'Missing required parameters'
            });
        }

        // Validate ObjectIds
        const isValidFacilityId = mongoose.Types.ObjectId.isValid(facilityId);
        const isValidSourceInvoiceId = mongoose.Types.ObjectId.isValid(sourceInvoiceId);
        console.log(`ObjectId validation - facilityId valid: ${isValidFacilityId}, sourceInvoiceId valid: ${isValidSourceInvoiceId}`);

        if (!isValidFacilityId || !isValidSourceInvoiceId) {
            console.log('Error: Invalid ObjectId format');
            return reply.code(400).send({
                success: false,
                error: 'Invalid Facility ID or Invoice ID format'
            });
        }

        // Validate selectedInvoices array
        if (!Array.isArray(selectedInvoices) || selectedInvoices.length === 0) {
            console.log('Error: Invalid selectedInvoices array');
            return reply.code(400).send({
                success: false,
                error: 'Selected invoices must be a non-empty array'
            });
        }

        // Get source invoice information
        console.log(`Fetching source invoice details for ${sourceInvoiceId}...`);
        const sourceInvoiceInfo = await getInvoiceModelById(facilityId, sourceInvoiceId);

        if (!sourceInvoiceInfo) {
            console.log(`Error: Source invoice ${sourceInvoiceId} not found`);
            return reply.code(404).send({
                success: false,
                error: 'Source invoice not found'
            });
        }

        const { model: SourceModel, invoice: sourceInvoice, type: sourceType } = sourceInvoiceInfo;
        console.log(`Source invoice found - type: ${sourceType}, invoiceNumber: ${sourceInvoice.invoiceNumber}`);
        console.log(`Source invoice details - balanceBroughtForward: ${sourceInvoice.balanceBroughtForward}`);

        // Calculate current balance for the source invoice
        const sourceBalance = calculateBalance(sourceInvoice);
        console.log(`Source invoice calculated balance: ${sourceBalance}`);

        // Verify the source invoice has a negative balance (credit)
        if (sourceBalance >= 0) {
            console.log(`Error: Source invoice has non-negative calculated balance: ${sourceBalance}`);
            return reply.code(400).send({
                success: false,
                error: 'Source invoice does not have an overpayment to apply'
            });
        }

        // Calculate available overpayment amount
        const availableOverpayment = Math.abs(sourceBalance);
        console.log(`Available overpayment: ${availableOverpayment}, Requested amount: ${overpaymentAmount}`);

        if (availableOverpayment < overpaymentAmount) {
            console.log(`Error: Requested amount ${overpaymentAmount} exceeds available credit ${availableOverpayment}`);
            return reply.code(400).send({
                success: false,
                error: 'Requested overpayment amount exceeds available credit'
            });
        }

        // Track remaining overpayment and results
        let remainingOverpayment = overpaymentAmount;
        const results = [];

        // Process each selected invoice
        console.log(`Beginning to process ${selectedInvoices.length} selected invoices...`);
        for (const invoiceId of selectedInvoices) {
            console.log(`\n--- Processing invoice: ${invoiceId} ---`);

            if (remainingOverpayment <= 0) {
                console.log(`Skipping invoice ${invoiceId} - no remaining overpayment`);
                break;
            }

            try {
                console.log(`Fetching target invoice details for ${invoiceId}...`);
                const targetInvoiceInfo = await getInvoiceModelById(facilityId, invoiceId);

                if (!targetInvoiceInfo) {
                    console.log(`Error: Target invoice ${invoiceId} not found`);
                    results.push({
                        invoiceId,
                        success: false,
                        message: 'Invoice not found'
                    });
                    continue;
                }

                const { model: TargetModel, invoice: targetInvoice, type: targetType } = targetInvoiceInfo;
                console.log(`Target invoice found - type: ${targetType}, invoiceNumber: ${targetInvoice.invoiceNumber}`);

                // Calculate outstanding amount on target invoice using the calculated balance
                let totalAmount, amountPaid;

                if (targetType === 'water') {
                    totalAmount = targetInvoice.charges?.totalMonthlyBill;
                    amountPaid = targetInvoice.amountPaid || 0;
                    console.log(`Water invoice - totalMonthlyBill: ${totalAmount}`);
                } else {
                    totalAmount = targetInvoice.totalAmount;
                    amountPaid = targetInvoice.amountPaid || 0;
                    console.log(`Regular/VAS invoice - totalAmount: ${totalAmount}`);
                }

                console.log(`Target invoice payment details - amountPaid: ${amountPaid}`);

                // Calculate current balance for the target invoice
                const targetBalance = calculateBalance(targetInvoice);
                console.log(`Target invoice calculated balance: ${targetBalance}`);

                // Only positive balances (amounts owed) should be considered for applying overpayment
                const outstandingAmount = targetBalance > 0 ? targetBalance : 0;
                console.log(`Outstanding amount: ${outstandingAmount}`);

                if (outstandingAmount <= 0) {
                    console.log(`Skipping invoice ${invoiceId} - no outstanding balance`);
                    results.push({
                        invoiceId,
                        success: false,
                        message: 'Invoice has no outstanding balance'
                    });
                    continue;
                }

                // Calculate amount to apply to this invoice
                const amountToApply = Math.min(remainingOverpayment, outstandingAmount);
                console.log(`Amount to apply to this invoice: ${amountToApply}`);

                // Calculate new amount paid
                const newAmountPaid = amountPaid + amountToApply;
                console.log(`New amount paid will be: ${newAmountPaid}`);

                // Calculate new balance after applying payment (for display only)
                const newCalculatedBalance = targetBalance - amountToApply;
                console.log(`New calculated balance will be: ${newCalculatedBalance}`);

                // Create reconciliation entry for target invoice
                const targetReconciliationEntry = {
                    date: new Date(),
                    amount: amountToApply,
                    type: 'overpay-received',
                    sourceInvoice: sourceInvoice.invoiceNumber,
                    notes: `Credit applied from invoice ${sourceInvoice.invoiceNumber}`,
                    paymentCompletion: 'Completed',
                    remainingBalance: newCalculatedBalance > 0 ? newCalculatedBalance : 0
                };
                console.log(`Created target reconciliation entry - remainingBalance: ${targetReconciliationEntry.remainingBalance}`);

                // Determine new status after applying payment
                const newStatus = determineInvoiceStatus(
                    newAmountPaid,
                    totalAmount,
                    targetInvoice.dueDate,
                    targetInvoice.balanceBroughtForward
                );
                console.log(`New status will be: ${newStatus}`);

                // Update based on invoice type
                console.log(`Updating target invoice ${invoiceId} in database...`);
                let updateResult;

                if (targetType === 'water') {
                    console.log('Using water invoice update schema');
                    updateResult = await TargetModel.findByIdAndUpdate(
                        invoiceId,
                        {
                            $set: {
                                amountPaid: newAmountPaid,
                                status: newStatus
                            },
                            $push: { reconciliationHistory: targetReconciliationEntry }
                        },
                        { new: true }
                    );
                } else {
                    console.log('Using regular/VAS invoice update schema');
                    updateResult = await TargetModel.findByIdAndUpdate(
                        invoiceId,
                        {
                            $set: {
                                amountPaid: newAmountPaid,
                                status: newStatus,
                                'paymentDetails.paymentStatus': newStatus === 'Paid' ? 'Completed' : 'Partial'
                            },
                            $push: { reconciliationHistory: targetReconciliationEntry }
                        },
                        { new: true }
                    );
                }

                if (updateResult) {
                    console.log(`Target invoice updated successfully - new status: ${updateResult.status}`);
                } else {
                    console.log('Warning: Target invoice update did not return updated document');
                }

                // Create reconciliation entry for source invoice
                const sourceReconciliationEntry = {
                    date: new Date(),
                    amount: amountToApply,
                    type: 'overpay-transfer',
                    destinationInvoice: targetInvoice.invoiceNumber,
                    notes: `Credit applied to invoice ${targetInvoice.invoiceNumber}`,
                    remainingBalance: null // Not applicable for transfers
                };
                console.log('Created source reconciliation entry');

                // Add entry to source invoice reconciliation history
                console.log(`Updating source invoice ${sourceInvoiceId} reconciliation history...`);
                const sourceUpdateResult = await SourceModel.findByIdAndUpdate(
                    sourceInvoiceId,
                    {
                        $push: { reconciliationHistory: sourceReconciliationEntry }
                    },
                    { new: true }
                );

                if (sourceUpdateResult) {
                    console.log('Source invoice reconciliation history updated successfully');
                } else {
                    console.log('Warning: Source invoice update did not return updated document');
                }

                // Reduce remaining overpayment
                remainingOverpayment -= amountToApply;
                console.log(`Remaining overpayment after this invoice: ${remainingOverpayment}`);

                results.push({
                    invoiceId,
                    success: true,
                    amountApplied: amountToApply,
                    newStatus: newStatus
                });

            } catch (error) {
                console.error(`Error processing invoice ${invoiceId}:`, error);
                console.error('Error stack:', error.stack);
                results.push({
                    invoiceId,
                    success: false,
                    message: error.message || 'Error processing invoice'
                });
            }
        }

        // We need to update the source invoice's paid amount to reflect the applied overpayment
        // Note: We are NOT modifying the balanceBroughtForward, only the amountPaid
        const totalApplied = overpaymentAmount - remainingOverpayment;
        const newSourceAmountPaid = (sourceInvoice.amountPaid || 0) + totalApplied;

        console.log(`Updating source invoice paid amount - original: ${sourceInvoice.amountPaid}, new: ${newSourceAmountPaid}`);

        const finalSourceUpdate = await SourceModel.findByIdAndUpdate(
            sourceInvoiceId,
            {
                $set: {
                    amountPaid: newSourceAmountPaid
                }
            },
            { new: true }
        );

        if (finalSourceUpdate) {
            console.log(`Source invoice final update successful - new amountPaid: ${finalSourceUpdate.amountPaid}`);
        } else {
            console.log('Warning: Source invoice final update did not return updated document');
        }

        // Calculate the remaining balance (on the fly) after applying overpayments
        const newSourceBalance = calculateBalance(finalSourceUpdate || sourceInvoice);
        const overpayAmount = newSourceBalance < 0 ? Math.abs(newSourceBalance) : 0;

        console.log(`Final balance - sourceBalance: ${newSourceBalance}, overpayAmount: ${overpayAmount}`);

        console.log('Operation completed successfully, preparing response');

        // Summarize results
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;
        console.log(`Results summary - successes: ${successCount}, failures: ${failCount}`);

        // Calculate total applied amount
        console.log(`Total applied: ${totalApplied}, remaining: ${remainingOverpayment}`);

        return reply.code(200).send({
            success: true,
            message: 'Overpayment applied successfully',
            data: {
                sourceInvoice: sourceInvoice.invoiceNumber,
                totalApplied: totalApplied,
                remainingOverpayment: remainingOverpayment,
                // For display, include the calculated balance
                calculatedBalance: newSourceBalance,
                // Include overpay for backwards compatibility 
                overpayAmount: overpayAmount,
                results
            }
        });

    } catch (error) {
        console.error('Error applying overpayment:', error);
        console.error('Error stack trace:', error.stack);
        return reply.code(500).send({
            success: false,
            error: error.message || 'Error applying overpayment'
        });
    } finally {
        console.log('=== End: apply_overpayment ===');
    }
};

module.exports = apply_overpayment;