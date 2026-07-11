// controllers/create_credit_note.js
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const mongoose = require('mongoose');

/**
 * Create a credit note for an invoice
 * This allows administrators to issue a credit that can be applied to future invoices
 */
const create_credit_note = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { accountNumber, amount, reason, applyToInvoice = false, userId } = request.body;
        
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
        
        // Create a negative balanceBroughtForward (credit)
        const currentBalance = invoice.balanceBroughtForward || 0;
        const newBalance = currentBalance - amount; // Subtract to create/increase credit
        
        // Generate a unique reference for this credit note
        const creditNoteRef = `CR${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
        
        // Add to reconciliation history
        const reconciliationEntry = {
            date: new Date(),
            amount: amount,
            type: 'credit-note',
            paymentReference: creditNoteRef,
            notes: reason || 'Credit note issued',
            remainingBalance: invoice.totalAmount - (invoice.amountPaid || 0) + newBalance
        };
        
        // Track user who created the credit note if provided
        if (userId) {
            reconciliationEntry.createdBy = new mongoose.Types.ObjectId(userId);
        }
        
        // Update variables for response
        let appliedAmount = 0;
        let updatedInvoice;
        
        // If requested, apply this credit to the invoice immediately
        if (applyToInvoice) {
            const remainingBalance = invoice.totalAmount - invoice.amountPaid + 
                (currentBalance > 0 ? currentBalance : 0);
                
            if (remainingBalance > 0) {
                appliedAmount = Math.min(amount, remainingBalance);
                
                // Create an application entry
                const applicationEntry = {
                    date: new Date(),
                    amount: appliedAmount,
                    type: 'balance-deduction',
                    paymentReference: creditNoteRef,
                    notes: 'Applied credit to current invoice',
                    remainingBalance: remainingBalance - appliedAmount
                };
                
                // Calculate the adjusted balance
                const adjustedBalance = newBalance + appliedAmount;
                
                // Update invoice applying both the credit and its usage in one operation
                updatedInvoice = await invoiceModel.findOneAndUpdate(
                    { accountNumber },
                    {
                        $inc: {
                            amountPaid: appliedAmount
                        },
                        $set: {
                            balanceBroughtForward: adjustedBalance,
                            status: determineInvoiceStatus(
                                (invoice.amountPaid || 0) + appliedAmount, 
                                invoice.totalAmount, 
                                invoice.dueDate, 
                                adjustedBalance
                            )
                        },
                        $push: {
                            reconciliationHistory: {
                                $each: [reconciliationEntry, applicationEntry]
                            }
                        }
                    },
                    { new: true }
                );
            } else {
                // No balance to apply to, just add the credit
                updatedInvoice = await invoiceModel.findOneAndUpdate(
                    { accountNumber },
                    {
                        $set: {
                            balanceBroughtForward: newBalance
                        },
                        $push: {
                            reconciliationHistory: reconciliationEntry
                        }
                    },
                    { new: true }
                );
            }
        } else {
            // Only add the credit without applying
            updatedInvoice = await invoiceModel.findOneAndUpdate(
                { accountNumber },
                {
                    $set: {
                        balanceBroughtForward: newBalance
                    },
                    $push: {
                        reconciliationHistory: reconciliationEntry
                    }
                },
                { new: true }
            );
        }
        
        return reply.code(200).send({
            success: true,
            message: 'Credit note created successfully',
            data: {
                invoiceNumber: invoice.invoiceNumber,
                accountNumber,
                creditAmount: amount,
                creditNoteRef,
                appliedAmount,
                newBalance: updatedInvoice.balanceBroughtForward,
                reason
            }
        });
        
    } catch (error) {
        console.error('Error creating credit note:', error);
        return reply.code(500).send({
            success: false,
            error: error.message || 'Error creating credit note'
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

module.exports = create_credit_note;