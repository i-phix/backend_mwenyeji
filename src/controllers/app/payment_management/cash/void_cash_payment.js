const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

/**
 * Reverses GL entries for voided cash payments
 * @param {Object} payment - The payment object being voided
 * @param {String} facilityId - The facility ID
 * @param {Object} user - The user voiding the payment
 * @param {String} voidReason - The reason for voiding
 * @returns {Promise<Object>} GL reversal result
 */
const reversePaymentGLEntry = async (payment, facilityId, user, voidReason) => {
    try {
        console.log('Starting GL entry reversal for payment:', payment.receiptNumber);

        // Get GL models
        const GLDoubleEntryModel = await getModel('GLAccountDoubleEntries', payservedb.GLAccountDoubleEntries.schema, facilityId);
        
        // Get GL Entry schema
        let GLEntrySchema;
        if (payservedb.GLEntries && payservedb.GLEntries.schema) {
            GLEntrySchema = payservedb.GLEntries.schema;
        } else if (payservedb.GLEntry && payservedb.GLEntry.schema) {
            GLEntrySchema = payservedb.GLEntry.schema;
        } else {
            GLEntrySchema = new mongoose.Schema({
                entryDate: { type: Date, required: true, default: Date.now },
                accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'GLAccount', required: true },
                creditAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'GLAccount' },
                amount: { type: Number, required: true },
                description: { type: String, trim: true },
                facilityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true },
                entryType: { type: String, enum: ['debit', 'credit'], required: true },
                createdAt: { type: Date, default: Date.now },
                updatedAt: { type: Date, default: Date.now },
                isActive: { type: Boolean, default: true }
            });
        }

        const GLEntryModel = await getModel('GLEntry', GLEntrySchema, facilityId);

        if (!GLDoubleEntryModel || !GLEntryModel) {
            console.log('GL models not available, skipping GL reversal');
            return null;
        }

        // Get the original GL entry record from payment's reconciliation details
        let originalGLEntryId = null;
        if (payment.reconciliationDetails && payment.reconciliationDetails.glEntryId) {
            originalGLEntryId = payment.reconciliationDetails.glEntryId;
        }

        if (!originalGLEntryId) {
            console.log('No GL entry ID found in payment, cannot reverse GL entries');
            return null;
        }

        // Find the original GL double entry record
        const originalGLEntry = await GLDoubleEntryModel.findById(originalGLEntryId);
        if (!originalGLEntry) {
            console.log('Original GL entry record not found:', originalGLEntryId);
            return null;
        }

        console.log('Found original GL entry:', originalGLEntry._id);

        // Create reversal GL entries (opposite of original)
        const reversalAmount = originalGLEntry.amount;
        const transactionId = payment.receiptNumber || `VOID-${Date.now().toString(36)}`;
        const paymentMethod = payment.paymentMethod || 'cash';

        // Create reversal GL entries
        const reversalGLEntries = await GLEntryModel.create([
            {
                entryDate: new Date(),
                accountId: originalGLEntry.accountcredited, // Credit the originally debited account
                creditAccountId: originalGLEntry.accountdebited,
                amount: reversalAmount,
                description: `Reversal - ${paymentMethod.toUpperCase()} payment voided (${transactionId}) for invoice ${payment.invoice.invoiceNumber}. Reason: ${voidReason}`,
                facilityId,
                entryType: 'debit',
            },
            {
                entryDate: new Date(),
                accountId: originalGLEntry.accountdebited, // Debit the originally credited account
                creditAccountId: originalGLEntry.accountcredited,
                amount: reversalAmount,
                description: `Reversal - Credit entry for voided payment (${transactionId}) for invoice ${payment.invoice.invoiceNumber}. Reason: ${voidReason}`,
                facilityId,
                entryType: 'credit',
            }
        ]);

        console.log(`Created reversal GL entries: ${reversalGLEntries.map(e => e._id).join(', ')}`);

        // Create reversal GL double entry record
        const reversalGLRecord = await GLDoubleEntryModel.create({
            facilityId: facilityId,
            accountdebited: originalGLEntry.accountcredited, // Reverse the accounts
            accountcredited: originalGLEntry.accountdebited,
            amount: reversalAmount,
            transactionId,
            description: `Reversal - Payment voided for invoice ${payment.invoice.invoiceNumber}. Reason: ${voidReason}`,
            entryIds: reversalGLEntries.map(e => e._id),
            primaryEntryId: reversalGLEntries[0]._id,
            originalEntryId: originalGLEntryId, // Reference to original entry
            isReversal: true,
            reversalReason: voidReason
        });

        console.log(`Created reversal GL record: ${reversalGLRecord._id}`);

        return {
            reversalGLRecordId: reversalGLRecord._id,
            reversalEntryIds: reversalGLEntries.map(e => e._id),
            originalGLEntryId: originalGLEntryId,
            amount: reversalAmount
        };

    } catch (glError) {
        console.error('Error reversing GL entries:', glError);
        console.error('Error stack:', glError.stack);
        return null;
    }
};

/**
 * Voids a cash payment
 * @param {Object} request - The request object
 * @param {Object} reply - The reply object
 * @returns {Promise<Object>} Response with voided payment or error
 */
const voidCashPayment = async (request, reply) => {
    try {
        console.log('=== Start: voidCashPayment ===');
        const { facilityId, paymentId } = request.params;
        const { voidReason } = request.body;

        // Get user from request (assuming authentication middleware sets this)
        const user = request.user;

        // Validate required fields
        if (!facilityId || !paymentId) {
            throw new Error('Missing required parameters');
        }

        if (!voidReason || !voidReason.trim()) {
            throw new Error('Void reason is required');
        }

        // Load CashPayment schema dynamically
        let cashPaymentSchema;
        if (payservedb.CashPayment && payservedb.CashPayment.schema) {
            cashPaymentSchema = payservedb.CashPayment.schema;
        } else {
            try {
                cashPaymentSchema = require('../../../../models/CashPayment').schema;
            } catch (err) {
                console.error('Error loading CashPayment schema:', err);
                throw new Error('Failed to load CashPayment schema');
            }
        }

        // Get CashPayment model for the specific facility
        const CashPayment = await getModel('CashPayment', cashPaymentSchema, facilityId);
        if (!CashPayment) throw new Error('Failed to get CashPayment model');

        // Find the payment
        const payment = await CashPayment.findById(paymentId);
        if (!payment) {
            throw new Error('Payment not found');
        }

        // Check if payment is already voided
        if (payment.isVoided) {
            return reply.code(400).send({
                success: false,
                message: 'Payment already voided'
            });
        }

        console.log(`Found payment: ${payment.receiptNumber}, Status: ${payment.approvalStatus}, Invoice: ${payment.invoice?.invoiceNumber}`);

        // Initialize GL reversal data
        let glReversalData = null;

        // If payment was approved and reconciled, reverse the invoice changes and GL entries
        if (payment.approvalStatus === 'Approved' &&
            ['Matched', 'Partial', 'Overpaid'].includes(payment.reconciliationStatus)) {

            // First, reverse GL entries if they exist
            glReversalData = await reversePaymentGLEntry(payment, facilityId, user, voidReason);

            // Determine which invoice schema to use
            let invoiceSchema;
            let invoiceModel;
            let isVasInvoice = false;

            if (payment.invoice.invoiceNumber.startsWith('VAS')) {
                invoiceSchema = payservedb.VasInvoice?.schema || require('../../../../models/VasInvoice').schema;
                invoiceModel = await getModel('VasInvoice', invoiceSchema, facilityId);
                isVasInvoice = true;
            } else if (payment.invoice.invoiceNumber.startsWith('W')) {
                invoiceSchema = payservedb.WaterInvoice?.schema || require('../../../../models/WaterInvoice').schema;
                invoiceModel = await getModel('WaterInvoice', invoiceSchema, facilityId);
            } else {
                invoiceSchema = payservedb.Invoice?.schema || require('../../../../models/Invoice').schema;
                invoiceModel = await getModel('Invoice', invoiceSchema, facilityId);
            }

            if (!invoiceModel) throw new Error('Failed to get Invoice model');

            // Find the invoice
            const invoice = await invoiceModel.findById(payment.invoice.invoiceId);

            if (invoice) {
                // Reverse amount paid
                const appliedAmount = payment.reconciliationDetails?.appliedAmount || 0;
                const newAmountPaid = Math.max(0, (invoice.amountPaid || 0) - appliedAmount);

                console.log(`Reversing payment - Applied amount: ${appliedAmount}, New amount paid: ${newAmountPaid}`);

                // Calculate new balance and status
                let newStatus;
                if (isVasInvoice) {
                    // For VAS invoices
                    const newBalance = (invoice.amount || 0) - newAmountPaid;
                    if (newBalance <= 0) {
                        newStatus = 'Paid';
                    } else if (newAmountPaid > 0) {
                        newStatus = 'Partially Paid';
                    } else if (invoice.dueDate && new Date() > new Date(invoice.dueDate)) {
                        newStatus = 'Overdue';
                    } else {
                        newStatus = 'Unpaid';
                    }
                } else {
                    // For standard invoices
                    const totalAmount = invoice.totalAmount || 0;
                    const balanceBroughtForward = invoice.balanceBroughtForward || 0;
                    newStatus = newAmountPaid <= 0 ? 'Unpaid' :
                                newAmountPaid < totalAmount ? 'Partially Paid' : 'Paid';
                }

                // Prepare void reconciliation entry
                const voidReconciliationEntry = {
                    date: new Date(),
                    amount: -appliedAmount, // Negative amount to show reversal
                    type: payment.paymentMethod || 'cash',
                    paymentReference: payment.paymentReference || payment.receiptNumber,
                    paymentCompletion: 'Voided',
                    notes: `Voided cash payment (${payment.receiptNumber}) - Reason: ${voidReason}`,
                    voidedBy: user ? `${user.firstName} ${user.lastName}` : 'System',
                    voidDate: new Date(),
                    glReversalId: glReversalData?.reversalGLRecordId || null
                };

                // Update invoice to remove the applied payment
                const updatedInvoice = await invoiceModel.findByIdAndUpdate(
                    invoice._id,
                    {
                        $set: {
                            amountPaid: newAmountPaid,
                            status: newStatus
                        },
                        $push: {
                            reconciliationHistory: voidReconciliationEntry
                        }
                    },
                    { new: true }
                );

                if (updatedInvoice) {
                    console.log(`Invoice updated - New status: ${newStatus}, Amount paid: ${newAmountPaid}`);

                    // Update account amount in main database if invoice has an accountNumber
                    if (invoice.accountNumber) {
                        try {
                            const Account = payservedb.Account;
                            const account = await Account.findOne({ accountNumber: invoice.accountNumber });

                            if (account) {
                                // Calculate new balance for the account
                                const newAccountBalance = (invoice.totalAmount || invoice.amount || 0) - newAmountPaid;
                                const finalAccountAmount = Math.max(0, newAccountBalance);

                                await Account.findOneAndUpdate(
                                    { accountNumber: invoice.accountNumber },
                                    { $set: { amount: finalAccountAmount } }
                                );

                                console.log(`Account updated - Account: ${invoice.accountNumber}, New amount: ${finalAccountAmount}`);
                            }
                        } catch (accountError) {
                            console.error('Error updating account:', accountError);
                        }
                    }
                } else {
                    console.log('Failed to update invoice');
                }
            } else {
                console.log('Invoice not found for payment reversal');
            }
        }

        // Update payment to mark it as voided
        const voidUpdate = {
            $set: {
                isVoided: true,
                voidedBy: {
                    userId: user ? new mongoose.Types.ObjectId(user._id) : null,
                    name: user ? `${user.firstName} ${user.lastName}` : 'System',
                    voidDate: new Date(),
                    reason: voidReason
                },
                // If payment was pending, reject it; if it was approved, mark it as voided
                approvalStatus: payment.approvalStatus === 'Pending' ? 'Rejected' : 'Voided',
                reconciliationStatus: 'Voided'
            }
        };

        // Add GL reversal information to payment record
        if (glReversalData) {
            voidUpdate.$set.glReversalDetails = {
                reversalGLRecordId: glReversalData.reversalGLRecordId,
                reversalEntryIds: glReversalData.reversalEntryIds,
                originalGLEntryId: glReversalData.originalGLEntryId,
                reversalAmount: glReversalData.amount,
                reversalDate: new Date()
            };
        }

        // Add rejection details if payment was pending
        if (payment.approvalStatus === 'Pending') {
            voidUpdate.$set.rejectedBy = {
                userId: user ? new mongoose.Types.ObjectId(user._id) : null,
                name: user ? `${user.firstName} ${user.lastName}` : 'System',
                rejectionDate: new Date(),
                reason: `Payment voided: ${voidReason}`
            };
        }

        const updatedPayment = await CashPayment.findByIdAndUpdate(
            paymentId,
            voidUpdate,
            { new: true }
        );

        if (!updatedPayment) {
            throw new Error('Failed to update payment status');
        }

        console.log('Payment voided successfully:', {
            paymentId: updatedPayment._id,
            receiptNumber: updatedPayment.receiptNumber,
            voidedBy: updatedPayment.voidedBy.name,
            glReversalProcessed: !!glReversalData
        });

        return reply.code(200).send({
            success: true,
            message: 'Payment voided successfully',
            data: {
                payment: updatedPayment,
                glReversal: glReversalData ? {
                    processed: true,
                    reversalGLRecordId: glReversalData.reversalGLRecordId,
                    reversalAmount: glReversalData.amount
                } : {
                    processed: false,
                    reason: 'No GL entries found to reverse'
                }
            }
        });

    } catch (err) {
        console.error('Error voiding cash payment:', err);
        console.error('Error stack:', err.stack);
        return reply.code(400).send({
            success: false,
            message: err.message || 'Failed to void cash payment'
        });
    } finally {
        console.log('=== End: voidCashPayment ===');
    }
};

module.exports = voidCashPayment;