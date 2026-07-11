// controllers/create_debit_note.js
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const mongoose = require('mongoose');

/**
 * Create a debit note for an invoice
 * This allows administrators to add additional charges to an invoice
 */
const create_debit_note = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { accountNumber, amount, reason, userId } = request.body;

        if (!accountNumber || !amount || amount <= 0) {
            return reply.code(400).send({
                success: false,
                error: 'Account number and positive amount are required'
            });
        }

        // Validate the facility ID
        if (!facilityId) {
            return reply.code(400).send({
                success: false,
                error: 'Facility ID is required'
            });
        }

        // Get the appropriate invoice model based on account number prefix
        const prefix = accountNumber.charAt(0);
        let invoiceModel;

        try {
            switch (prefix) {
                case '5':
                case '6':
                    invoiceModel = await getModel(
                        "Invoice",
                        payservedb.Invoice.schema,
                        facilityId
                    );
                    break;
                case '8':
                    invoiceModel = await getModel(
                        "VasInvoice",
                        payservedb.VasInvoice.schema,
                        facilityId
                    );
                    break;
                default:
                    return reply.code(400).send({
                        success: false,
                        error: 'Invalid account number prefix'
                    });
            }
        } catch (error) {
            console.error('Error getting invoice model:', error);
            return reply.code(500).send({
                success: false,
                error: 'Error accessing facility database'
            });
        }

        // Find the invoice
        const invoice = await invoiceModel.findOne({ accountNumber });
        if (!invoice) {
            return reply.code(404).send({
                success: false,
                error: 'Invoice not found'
            });
        }

        // Add to the current balance (creating a debit)
        const currentBalance = invoice.balanceBroughtForward || 0;
        let newBalance = currentBalance;

        // If there's a negative balance (credit), reduce it first
        if (currentBalance < 0) {
            const remainingCredit = Math.abs(currentBalance);
            if (remainingCredit >= amount) {
                // The credit covers the entire debit
                newBalance = currentBalance + amount;
            } else {
                // The credit covers part of the debit
                newBalance = amount - remainingCredit;
            }
        } else {
            // Just add to the current balance
            newBalance = currentBalance + amount;
        }

        // Generate a unique reference for this debit note
        const debitNoteRef = `DR${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

        // Add to reconciliation history
        const reconciliationEntry = {
            date: new Date(),
            amount: amount,
            type: 'debit-note',
            paymentReference: debitNoteRef,
            notes: reason || 'Additional charge added',
            remainingBalance: invoice.totalAmount - (invoice.amountPaid || 0) + newBalance
        };

        // Track user who created the debit note if provided
        if (userId) {
            reconciliationEntry.createdBy = new mongoose.Types.ObjectId(userId);
        }

        // Calculate new status - if adding a charge to a Paid invoice, set it back to Unpaid
        let newStatus = determineInvoiceStatus(
            invoice.amountPaid || 0,
            invoice.totalAmount,
            invoice.dueDate,
            newBalance
        );

        // Update the invoice
        const updatedInvoice = await invoiceModel.findOneAndUpdate(
            { accountNumber },
            {
                $set: {
                    balanceBroughtForward: newBalance,
                    status: newStatus
                },
                $push: {
                    reconciliationHistory: reconciliationEntry
                }
            },
            { new: true }
        );

        // Update the Account model in main database to reflect the new balance
        try {
            const Account = payservedb.Account;
            const effectiveBalance = invoice.totalAmount - (invoice.amountPaid || 0) + newBalance;

            await Account.findOneAndUpdate(
                { accountNumber },
                {
                    $set: { amount: Math.max(0, effectiveBalance) }
                }
            );
        } catch (accountError) {
            console.error('Warning: Failed to update Account in main database:', accountError);
            // Continue despite error - we'll handle this asynchronously
        }

        return reply.code(200).send({
            success: true,
            message: 'Debit note created successfully',
            data: {
                invoiceNumber: invoice.invoiceNumber,
                accountNumber,
                debitAmount: amount,
                debitNoteRef,
                newBalance: updatedInvoice.balanceBroughtForward,
                newStatus: updatedInvoice.status,
                reason
            }
        });

    } catch (error) {
        console.error('Error creating debit note:', error);
        return reply.code(500).send({
            success: false,
            error: error.message || 'Error creating debit note'
        });
    }
};

// Helper function to determine invoice status
const determineInvoiceStatus = (amountPaid, totalAmount, dueDate, balanceBroughtForward = 0) => {
    // Calculate total owed including any brought forward balance
    const totalOwed = totalAmount + (balanceBroughtForward > 0 ? balanceBroughtForward : 0);
    // Calculate effective balance considering credits
    const effectiveBalance = totalOwed - amountPaid - (balanceBroughtForward < 0 ? Math.abs(balanceBroughtForward) : 0);

    if (effectiveBalance <= 0) return 'Paid';
    if (effectiveBalance > 0 && effectiveBalance < totalOwed) return 'Partially Paid';
    if (dueDate && new Date() > new Date(dueDate)) return 'Overdue';
    return 'Unpaid';
};

module.exports = create_debit_note;