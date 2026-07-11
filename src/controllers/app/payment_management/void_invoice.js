const { getModel } = require('../../../utils/getModel');
const payservedb = require("payservedb");
const mongoose = require('mongoose');
const axios = require('axios');

/**
 * Enhanced void_invoice endpoint to void invoices from different collections.
 *
 * After a successful void, if the invoice was previously synced to KRA via eTims
 * (txsync.status === "synced"), this handler automatically triggers a credit note
 * submission to the invoice service, which in turn calls KRA.
 *
 * Credit note trigger is fire-and-forget with structured error logging — a failure
 * there does NOT roll back the void.
 */
const void_invoice = async (req, reply) => {
    try {
        const { facilityId, invoiceId } = req.params;
        const { reason, userId, userName, userRole } = req.body;

        // Validate required parameters
        if (!reason) {
            return reply.code(400).send({ error: "Void reason is required" });
        }

        if (!userId || !userName || !userRole) {
            return reply.code(400).send({ error: "User information (userId, userName, userRole) is required" });
        }

        console.log(`Starting to void invoice: ${invoiceId}`);

        // ── Locate invoice across all collections ────────────────────────────
        let invoice = null;
        let invoiceType = null;
        let invoiceModel = null;

        try {
            const standardInvoiceModel = await getModel("Invoice", payservedb.Invoice.schema, facilityId);
            invoice = await standardInvoiceModel.findById(invoiceId);
            if (invoice) {
                console.log('Found invoice in standard Invoice collection');
                invoiceModel = standardInvoiceModel;
                invoiceType = 'invoice';
            }
        } catch (error) {
            console.log('Error checking standard Invoice collection:', error.message);
        }

        if (!invoice) {
            try {
                const waterInvoiceModel = await getModel("WaterInvoice", payservedb.WaterInvoice.schema, facilityId);
                invoice = await waterInvoiceModel.findById(invoiceId);
                if (invoice) {
                    console.log('Found invoice in WaterInvoice collection');
                    invoiceModel = waterInvoiceModel;
                    invoiceType = 'waterinvoice';
                }
            } catch (error) {
                console.log('Error checking WaterInvoice collection:', error.message);
            }
        }

        if (!invoice) {
            try {
                const vasInvoiceModel = await getModel("VasInvoice", payservedb.VasInvoice.schema, facilityId);
                invoice = await vasInvoiceModel.findById(invoiceId);
                if (invoice) {
                    console.log('Found invoice in VasInvoice collection');
                    invoiceModel = vasInvoiceModel;
                    invoiceType = 'vasinvoice';
                }
            } catch (error) {
                console.log('Error checking VasInvoice collection:', error.message);
            }
        }

        if (!invoice) {
            return reply.code(404).send({ error: "Invoice not found in any collection" });
        }

        if (!invoiceModel) {
            return reply.code(500).send({ error: "Failed to get invoice model" });
        }

        // ── Guard rails ──────────────────────────────────────────────────────
        const allowedStatuses = ["Unpaid", "Overdue", "Pending"];
        const amountPaid = invoice.amountPaid || 0;

        if (invoice.status === "Void") {
            return reply.code(400).send({ error: "Invoice is already voided" });
        }

        if (!allowedStatuses.includes(invoice.status)) {
            return reply.code(400).send({
                error: `Cannot void invoice with status "${invoice.status}". Only invoices with statuses: ${allowedStatuses.join(', ')} can be voided.`,
                currentStatus: invoice.status,
                allowedStatuses,
            });
        }

        if (amountPaid > 0) {
            return reply.code(400).send({
                error: `Cannot void invoice that has payments. This invoice has received ${amountPaid} in payments.`,
                currentStatus: invoice.status,
                amountPaid,
                totalAmount: invoice.totalAmount,
            });
        }

        if (invoice.reconciliationHistory && invoice.reconciliationHistory.length > 0) {
            const hasPayments = invoice.reconciliationHistory.some(record =>
                ['payment', 'cash', 'cheque', 'bank-transfer', 'mpesa-transfer'].includes(record.type)
            );
            if (hasPayments) {
                return reply.code(400).send({
                    error: "Cannot void invoice that has payment history in reconciliation records.",
                    currentStatus: invoice.status,
                    hasPaymentHistory: true,
                });
            }
        }

        // ── Capture eTims sync state BEFORE mutating the invoice ─────────────
        // We read this now so the credit note trigger below has reliable data
        // regardless of what the save() does to the document.
        const wasEtimsSynced = invoice.txsync?.status === "synced";
        const originalEtimsInvoiceNo = invoice.txsync?.etimsInvoiceNo || null;

        const accountNumber = invoice.accountNumber;
        const previousStatus = invoice.status;
        const voidDate = new Date();
        const originalAmount = invoice.totalAmount;

        // ── GL reversal ──────────────────────────────────────────────────────
        let glReversalId = null;
        if (invoice.invoiceDoubleEntryAccount || invoice.paymentDoubleEntryAccount) {
            try {
                const GLDoubleEntryModel = await getModel(
                    "GLAccountDoubleEntries",
                    payservedb.GLAccountDoubleEntries.schema,
                    facilityId
                );

                glReversalId = await createGLReversalEntry(
                    invoice,
                    GLDoubleEntryModel,
                    facilityId,
                    userId,
                    userName,
                    reason
                );

                if (glReversalId) {
                    console.log(`Created GL reversal entry: ${glReversalId}`);
                } else {
                    console.log('GL reversal creation returned null - check logs for details');
                }
            } catch (glError) {
                console.error("Error processing GL reversal:", glError.message);
                return reply.code(500).send({
                    error: "Failed to process GL reversal entries",
                    details: glError.message,
                });
            }
        }

        // ── Void the invoice ─────────────────────────────────────────────────
        invoice.status = "Void";
        invoice.voidMetadata = {
            voidedBy: { userId, name: userName, role: userRole },
            voidedAt: voidDate,
            reason,
            previousStatus,
            glReversalId: glReversalId || null,
        };

        if (!invoice.reconciliationHistory) {
            invoice.reconciliationHistory = [];
        }

        invoice.reconciliationHistory.push({
            date: voidDate,
            amount: originalAmount,
            type: 'balance-deduction',
            sourceInvoice: invoice.invoiceNumber,
            destinationInvoice: null,
            paymentReference: `VOID-${invoiceId}`,
            paymentCompletion: 'void',
            remainingBalance: 0,
            notes: `Invoice voided by ${userName} (${userRole}): ${reason}. Previous status: ${previousStatus}`,
            exchangeRate: 1,
            originalCurrency: {
                code: invoice.currency?.code || 'USD',
                amount: originalAmount,
            },
        });

        await invoice.save();

        // ── Update Account balance ────────────────────────────────────────────
        if (accountNumber) {
            try {
                const Account = payservedb.Account;
                const accountUpdateResult = await Account.findOneAndUpdate(
                    { accountNumber },
                    {
                        $set: {
                            amount: 0,
                            lastUpdated: voidDate,
                            lastUpdatedBy: userName,
                        },
                    },
                    { new: true }
                );

                if (accountUpdateResult) {
                    console.log(`Updated account ${accountNumber} amount to 0`);
                } else {
                    console.log(`Account ${accountNumber} not found in main database`);
                }
            } catch (accountError) {
                console.error("Error updating account:", accountError.message);
            }
        }

        // ── eTims Credit Note trigger ─────────────────────────────────────────
        // Only required when the invoice was successfully synced to KRA.
        // WaterInvoice and VasInvoice types don't carry txsync so they're
        // naturally excluded unless you add that field to those schemas.
        let creditNoteResult = null;

        if (wasEtimsSynced && invoiceType === 'invoice') {
            console.log(
                `[eTims][CreditNote] Invoice ${invoice.invoiceNumber} was eTims-synced ` +
                `(eTims ref: ${originalEtimsInvoiceNo}). Triggering credit note submission.`
            );
            creditNoteResult = await triggerCreditNote({ facilityId, invoiceId });
        } else if (wasEtimsSynced) {
            console.log(
                `[eTims][CreditNote] Invoice ${invoice.invoiceNumber} is type "${invoiceType}" ` +
                `and was eTims-synced but credit notes are only supported for standard invoices.`
            );
        } else {
            console.log(
                `[eTims][CreditNote] Invoice ${invoice.invoiceNumber} was NOT synced to eTims ` +
                `(txsync.status = "${invoice.txsync?.status || 'not_synced'}"). No credit note needed.`
            );
        }

        return reply.code(200).send({
            message: "Invoice successfully voided",
            invoice: {
                id: invoice._id,
                invoiceNumber: invoice.invoiceNumber,
                accountNumber: invoice.accountNumber,
                status: invoice.status,
                previousStatus,
                originalAmount,
                amountPaid,
                voidedAt: voidDate,
                voidedBy: userName,
                reason,
                glReversalId,
            },
            invoiceType,
            glReversalCreated: !!glReversalId,
            // Inform the caller whether a credit note was attempted and what happened
            creditNote: creditNoteResult,
        });

    } catch (error) {
        console.error("Error voiding invoice:", error.message);
        console.error("Error stack:", error.stack);
        return reply.code(500).send({
            error: "Internal server error",
            message: error.message,
        });
    }
};

// ── Credit Note helper ────────────────────────────────────────────────────────

/**
 * Call the invoice service to submit a credit note to KRA for a voided,
 * previously eTims-synced invoice.
 *
 * This is intentionally non-throwing — a credit note failure should be logged
 * and surfaced in the response but must NOT roll back the void.
 *
 * @param {{ facilityId: string, invoiceId: string }} params
 * @returns {{ attempted: boolean, success: boolean, message: string, data?: object }}
 */
async function triggerCreditNote({ facilityId, invoiceId }) {
    const invoiceServiceUrl = process.env.INVOICE_SERVICE_NEW_URL;

    if (!invoiceServiceUrl) {
        console.error("[eTims][CreditNote] INVOICE_SERVICE_NEW_URL is not set. Cannot trigger credit note.");
        return {
            attempted: false,
            success: false,
            message: "Invoice service URL not configured. Credit note was NOT submitted to KRA. Retry manually.",
        };
    }

    try {
        const response = await axios.post(
            `${invoiceServiceUrl}/credit-note`,
            { facilityId, invoiceId },
            { timeout: 15000 }
        );

        console.log(
            `[eTims][CreditNote] Credit note submitted successfully for invoice ${invoiceId}:`,
            response.data
        );

        return {
            attempted: true,
            success: true,
            message: "Credit note submitted to KRA successfully.",
            data: response.data,
        };
    } catch (error) {
        const detail = error.response?.data || error.message;

        console.error(
            `[eTims][CreditNote] Failed to submit credit note for invoice ${invoiceId}:`,
            detail
        );

        return {
            attempted: true,
            success: false,
            message: "Void succeeded but credit note submission to KRA failed. You can retry via POST /v1/api/etims/credit-note/retry.",
            error: detail,
        };
    }
}

// ── Existing helpers (unchanged) ─────────────────────────────────────────────

const determineInvoiceTypeFromPrefix = (prefix) => {
    switch (prefix) {
        case '5':
        case '6':
            return 'invoice';
        case '7':
            return 'waterinvoice';
        case '8':
            return 'vasinvoice';
        default:
            return 'unknown';
    }
};

const createGLReversalEntry = async (invoice, GLDoubleEntryModel, facilityId, userId, userName, reason) => {
    try {
        const glReferenceId = invoice.invoiceDoubleEntryAccount || invoice.paymentDoubleEntryAccount;

        if (!glReferenceId) {
            console.log(`No GL reference found for invoice ${invoice.invoiceNumber}`);
            return null;
        }

        const originalEntry = await GLDoubleEntryModel.findById(glReferenceId);

        if (!originalEntry) {
            console.log(`No GL entry found for invoice ${invoice.invoiceNumber} with reference ${glReferenceId}`);
            return null;
        }

        console.log(`Creating GL reversal for original entry:`, {
            id: originalEntry._id,
            debitAccount: originalEntry.accountdebited,
            creditAccount: originalEntry.accountcredited,
            amount: originalEntry.amount,
            transactionId: originalEntry.transactionId,
        });

        const reversalEntry = {
            facilityId,
            accountdebited: originalEntry.accountcredited,
            accountcredited: originalEntry.accountdebited,
            amount: originalEntry.amount,
            transactionId: `VOID-${Date.now()}-${invoice.invoiceNumber}`,
            description: `Reversal for voided invoice ${invoice.invoiceNumber}: ${reason}`,
            createdBy: {
                userId: new mongoose.Types.ObjectId(userId),
                name: userName,
            },
            createdAt: new Date(),
            isReversal: true,
            originalTransactionId: originalEntry.transactionId,
            originalEntryId: originalEntry._id,
            referencedDocumentId: invoice._id,
            referencedDocumentType: 'Invoice',
            voidReason: reason,
        };

        const glEntry = await GLDoubleEntryModel.create(reversalEntry);
        console.log(`Created GL reversal entry: ${glEntry._id} for voided invoice: ${invoice.invoiceNumber}`);

        try {
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
                    isActive: { type: Boolean, default: true },
                    isReversal: { type: Boolean, default: false },
                    originalEntryRef: { type: mongoose.Schema.Types.ObjectId, ref: 'GLAccountDoubleEntries' },
                    doubleEntryRef: { type: mongoose.Schema.Types.ObjectId, ref: 'GLAccountDoubleEntries' },
                });
            }

            const GLEntryModel = await getModel('GLEntry', GLEntrySchema, facilityId);

            if (GLEntryModel) {
                const detailedEntries = await GLEntryModel.create([
                    {
                        entryDate: new Date(),
                        accountId: reversalEntry.accountdebited,
                        creditAccountId: reversalEntry.accountcredited,
                        amount: reversalEntry.amount,
                        description: `Debit reversal for voided invoice ${invoice.invoiceNumber}`,
                        facilityId: new mongoose.Types.ObjectId(facilityId),
                        entryType: 'debit',
                        isReversal: true,
                        originalEntryRef: glReferenceId,
                        doubleEntryRef: glEntry._id,
                    },
                    {
                        entryDate: new Date(),
                        accountId: reversalEntry.accountcredited,
                        creditAccountId: reversalEntry.accountdebited,
                        amount: reversalEntry.amount,
                        description: `Credit reversal for voided invoice ${invoice.invoiceNumber}`,
                        facilityId: new mongoose.Types.ObjectId(facilityId),
                        entryType: 'credit',
                        isReversal: true,
                        originalEntryRef: glReferenceId,
                        doubleEntryRef: glEntry._id,
                    },
                ]);

                console.log(`Created ${detailedEntries.length} detailed GL entries for reversal`);
            }
        } catch (detailedEntryError) {
            console.error('Error creating detailed GL entries:', detailedEntryError.message);
        }

        return glEntry._id.toString();
    } catch (error) {
        console.error('Error creating GL reversal entries:', error.message);
        console.error('Error stack:', error.stack);
        throw error;
    }
};

module.exports = void_invoice;