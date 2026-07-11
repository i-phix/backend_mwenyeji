const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const axios = require('axios');

/**
 * Helper function to determine invoice status based on payment and balance information
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
 * Calculate the current balance for any type of invoice
 * Handles different invoice structures
 * 
 * @param {Object} invoice - The invoice object
 * @returns {Number} The calculated balance
 */
const calculateInvoiceBalance = (invoice) => {
    // For VAS invoices which use 'amount' field instead of 'totalAmount'
    if (invoice.amount !== undefined) {
        const totalAmount = invoice.amount;
        const amountPaid = invoice.amountPaid || 0;
        const calculatedBalance = totalAmount - amountPaid;

        console.log(`VAS Invoice balance - amount: ${totalAmount}, amountPaid: ${amountPaid}, calculatedBalance: ${calculatedBalance}`);

        return calculatedBalance;
    }
    
    // For standard and water invoices
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

/**
 * Sends a message to the messaging queue
 * 
 * @param {String} user - The sender identifier
 * @param {String} recipient - The recipient's phone number
 * @param {String} subject - The message subject
 * @param {String} messageBody - The message content
 * @param {String} type - The message type
 * @returns {Promise} - Promise resolving to the API response
 */
const sendMessageToQueue = async (user, recipient, subject, messageBody, type) => {
    try {
        // Create the message payload
        const messagePayload = {
            user,
            recipient,
            subject,
            type,
            message: messageBody,
        };

        const baseUrl = process.env.messagingServiceUrl || 'http://localhost:4006/api/messaging';
        // Send the message payload to the API endpoint
        const response = await axios.post(`${baseUrl}`, messagePayload);

        // Log or handle the response
        console.log('Message sent successfully:', response.data);
        return response.data;

    } catch (error) {
        // Log the error in case of failure
        console.error(`Error sending message to queue: ${error.message}`);
        throw error;
    }
};

/**
 * Transfer credit from one invoice to another
 * This can be used to:
 * 1. Transfer overpayment credit from one invoice to another
 * 2. Apply a partial payment from one invoice to help pay another
 * 3. Reconcile payments across multiple invoices
 * 
 * @param {Object} request - The request object
 * @param {Object} reply - The reply object
 * @returns {Promise<Object>} - Response with transfer details
 */
const transfer_credit = async (request, reply) => {
    console.log('=== Start: transfer_invoice_credit ===');
    console.log(`Request params: ${JSON.stringify(request.params)}`);
    console.log(`Request body: ${JSON.stringify(request.body)}`);

    try {
        const { facilityId } = request.params;
        const { 
            sourceAccountNumber, 
            destinationAccountNumber, 
            amount,
            transferType,
            notes
        } = request.body;

        // Validate required parameters
        if (!facilityId || !sourceAccountNumber || !destinationAccountNumber || !amount) {
            console.log('Error: Missing required parameters');
            return reply.code(400).send({
                success: false,
                error: 'Facility ID, source account, destination account, and amount are required'
            });
        }

        if (parseFloat(amount) <= 0) {
            console.log('Error: Amount must be greater than zero');
            return reply.code(400).send({
                success: false,
                error: 'Transfer amount must be greater than zero'
            });
        }

        // Ensure source and destination are different
        if (sourceAccountNumber === destinationAccountNumber) {
            console.log('Error: Source and destination accounts must be different');
            return reply.code(400).send({
                success: false,
                error: 'Source and destination accounts must be different'
            });
        }

        // Get the Account model from payservedb package
        const Account = payservedb.Account;

        // Find the source and destination accounts
        const [sourceAccount, destinationAccount] = await Promise.all([
            Account.findOne({ accountNumber: sourceAccountNumber }),
            Account.findOne({ accountNumber: destinationAccountNumber })
        ]);

        // Validate source and destination accounts
        if (!sourceAccount) {
            console.log(`Error: Source account not found - ${sourceAccountNumber}`);
            return reply.code(404).send({
                success: false,
                error: 'Source account not found'
            });
        }

        if (!destinationAccount) {
            console.log(`Error: Destination account not found - ${destinationAccountNumber}`);
            return reply.code(404).send({
                success: false,
                error: 'Destination account not found'
            });
        }

        console.log(`Found source account for facility: ${sourceAccount.facilityId}`);
        console.log(`Found destination account for facility: ${destinationAccount.facilityId}`);

        // Check if both accounts belong to the same facility
        if (sourceAccount.facilityId.toString() !== facilityId || 
            destinationAccount.facilityId.toString() !== facilityId) {
            console.log('Error: Accounts must belong to the specified facility');
            return reply.code(400).send({
                success: false,
                error: 'Accounts must belong to the specified facility'
            });
        }

        // Get invoice models based on account number prefixes
        const getInvoiceModel = async (accountNumber, facilityId) => {
            const prefix = accountNumber.charAt(0);
            let invoiceModel, invoiceType;

            console.log(`Determining invoice type from prefix: ${prefix}`);
            switch (prefix) {
                case '5':
                case '6':
                    invoiceModel = await getModel(
                        "Invoice",
                        payservedb.Invoice.schema,
                        facilityId
                    );
                    invoiceType = 'invoice';
                    console.log('Using Invoice model');
                    break;
                case '7':
                    invoiceModel = await getModel(
                        "WaterInvoice",
                        payservedb.WaterInvoice.schema,
                        facilityId
                    );
                    invoiceType = 'waterinvoice';
                    console.log('Using WaterInvoice model');
                    break;
                case '8':
                    invoiceModel = await getModel(
                        "VasInvoice",
                        payservedb.VasInvoice.schema,
                        facilityId
                    );
                    invoiceType = 'vasinvoice';
                    console.log('Using VasInvoice model');
                    break;
                default:
                    throw new Error(`Invalid account number prefix: ${prefix}`);
            }

            return { invoiceModel, invoiceType };
        };

        // Get source and destination invoice models
        const { invoiceModel: sourceInvoiceModel, invoiceType: sourceInvoiceType } = 
            await getInvoiceModel(sourceAccountNumber, facilityId);
        
        const { invoiceModel: destinationInvoiceModel, invoiceType: destinationInvoiceType } = 
            await getInvoiceModel(destinationAccountNumber, facilityId);

        // Find the source and destination invoices
        const sourceInvoice = await sourceInvoiceModel.findOne({ accountNumber: sourceAccountNumber });
        const destinationInvoice = await destinationInvoiceModel.findOne({ accountNumber: destinationAccountNumber });

        if (!sourceInvoice) {
            console.log(`Error: Source invoice not found for account: ${sourceAccountNumber}`);
            return reply.code(404).send({
                success: false,
                error: 'Source invoice not found'
            });
        }

        if (!destinationInvoice) {
            console.log(`Error: Destination invoice not found for account: ${destinationAccountNumber}`);
            return reply.code(404).send({
                success: false,
                error: 'Destination invoice not found'
            });
        }

        console.log(`Found source invoice: ${sourceInvoice.invoiceNumber}`);
        console.log(`Found destination invoice: ${destinationInvoice.invoiceNumber}`);

        // Calculate source invoice balance
        const sourceBalance = calculateInvoiceBalance(sourceInvoice);

        // For overpayment/credit transfer, check if source has enough credit
        if (transferType === 'credit' || transferType === 'overpayment') {
            if (sourceBalance >= 0) {
                console.log(`Error: Source invoice has no credit available - balance: ${sourceBalance}`);
                return reply.code(400).send({
                    success: false,
                    error: 'Source invoice has no credit available for transfer'
                });
            }

            const availableCredit = Math.abs(sourceBalance);
            if (parseFloat(amount) > availableCredit) {
                console.log(`Error: Requested amount exceeds available credit - requested: ${amount}, available: ${availableCredit}`);
                return reply.code(400).send({
                    success: false,
                    error: `Requested amount exceeds available credit. Maximum available: ${availableCredit}`
                });
            }
        } else if (sourceBalance <= 0) {
            // For other transfer types, make sure source invoice is fully paid
            console.log(`Error: Source invoice must be fully paid for payment transfer - balance: ${sourceBalance}`);
            return reply.code(400).send({
                success: false,
                error: 'Source invoice must be fully paid for payment transfer'
            });
        }

        // Calculate destination invoice balance
        const destinationBalance = calculateInvoiceBalance(destinationInvoice);

        if (destinationBalance <= 0) {
            console.log(`Error: Destination invoice is already fully paid - balance: ${destinationBalance}`);
            return reply.code(400).send({
                success: false,
                error: 'Destination invoice is already fully paid'
            });
        }

        // If transfer amount is greater than destination balance, adjust amount
        const transferAmount = Math.min(parseFloat(amount), destinationBalance);

        // Generate a unique transaction ID for this transfer
        const transferId = `TRANSFER-${Date.now()}${Math.floor(Math.random() * 1000)}`;

        // Get source customer information for notification purposes
        let sourceCustomer = null;
        let destinationCustomer = null;

        try {
            const Customer = payservedb.Customer;
            
            // Get source customer
            if (sourceInvoice.customerId) {
                sourceCustomer = await Customer.findById(sourceInvoice.customerId).lean();
            } else if (sourceInvoice.client?.clientId) {
                sourceCustomer = await Customer.findById(sourceInvoice.client.clientId).lean();
            } else if (sourceInvoice.customerInfo) {
                sourceCustomer = sourceInvoice.customerInfo;
            }

            // Get destination customer
            if (destinationInvoice.customerId) {
                destinationCustomer = await Customer.findById(destinationInvoice.customerId).lean();
            } else if (destinationInvoice.client?.clientId) {
                destinationCustomer = await Customer.findById(destinationInvoice.client.clientId).lean();
            } else if (destinationInvoice.customerInfo) {
                destinationCustomer = destinationInvoice.customerInfo;
            }
            
            console.log('Source customer:', sourceCustomer ? 
                `${sourceCustomer.firstName || ''} ${sourceCustomer.lastName || ''} (${sourceCustomer.phoneNumber || sourceCustomer.phone || 'No phone'})` : 
                'Not found');
            
            console.log('Destination customer:', destinationCustomer ? 
                `${destinationCustomer.firstName || ''} ${destinationCustomer.lastName || ''} (${destinationCustomer.phoneNumber || destinationCustomer.phone || 'No phone'})` : 
                'Not found');
                
        } catch (error) {
            console.log('Error fetching customer details:', error.message);
            // Continue without customer details
        }

        // Create reconciliation entry for source invoice
        const sourceReconciliationEntry = {
            date: new Date(),
            amount: transferAmount,
            type: transferType === 'credit' ? 'credit-transfer' : 'payment-transfer',
            paymentReference: transferId,
            notes: notes || `Credit transfer to invoice #${destinationInvoice.invoiceNumber}`,
            destinationInvoice: destinationAccountNumber,
            remainingBalance: sourceBalance + (transferType === 'credit' ? transferAmount : 0)
        };

        // Create reconciliation entry for destination invoice
        const destinationReconciliationEntry = {
            date: new Date(),
            amount: transferAmount,
            type: transferType === 'credit' ? 'credit-received' : 'payment-received',
            paymentReference: transferId,
            notes: notes || `Credit received from invoice #${sourceInvoice.invoiceNumber}`,
            sourceInvoice: sourceAccountNumber,
            remainingBalance: destinationBalance - transferAmount,
            paymentCompletion: ((destinationInvoice.amountPaid + transferAmount) / 
                (destinationInvoice.totalAmount || destinationInvoice.amount)) * 100 + '%'
        };

        // Update source invoice
        const sourceUpdate = {
            $push: {
                reconciliationHistory: sourceReconciliationEntry
            }
        };

        // If this is a credit transfer, we need to adjust the amountPaid
        if (transferType === 'credit' || transferType === 'overpayment') {
            sourceUpdate.$inc = { 
                amountPaid: -transferAmount 
            };

            // Re-calculate status based on adjusted payment
            const newSourceAmountPaid = (sourceInvoice.amountPaid || 0) - transferAmount;
            const newSourceStatus = determineInvoiceStatus(
                newSourceAmountPaid,
                sourceInvoice.totalAmount || sourceInvoice.amount,
                sourceInvoice.dueDate,
                sourceInvoice.balanceBroughtForward
            );

            sourceUpdate.$set = { 
                status: newSourceStatus
            };
        }

        // Update destination invoice
        const newDestinationAmountPaid = (destinationInvoice.amountPaid || 0) + transferAmount;
        const newDestinationStatus = determineInvoiceStatus(
            newDestinationAmountPaid,
            destinationInvoice.totalAmount || destinationInvoice.amount,
            destinationInvoice.dueDate,
            destinationInvoice.balanceBroughtForward
        );

        const destinationUpdate = {
            $push: {
                reconciliationHistory: destinationReconciliationEntry
            },
            $inc: {
                amountPaid: transferAmount
            },
            $set: {
                status: newDestinationStatus,
                paymentStatus: destinationBalance - transferAmount <= 0 ? 'Completed' : 'Partial',
                lastPaymentDate: new Date(),
                lastTransactionId: transferId
            }
        };

        // Execute updates
        const [updatedSourceInvoice, updatedDestinationInvoice] = await Promise.all([
            sourceInvoiceModel.findOneAndUpdate(
                { accountNumber: sourceAccountNumber },
                sourceUpdate,
                { new: true }
            ),
            destinationInvoiceModel.findOneAndUpdate(
                { accountNumber: destinationAccountNumber },
                destinationUpdate,
                { new: true }
            )
        ]);

        if (!updatedSourceInvoice || !updatedDestinationInvoice) {
            console.log('Error: Failed to update one or both invoices');
            return reply.code(500).send({
                success: false,
                error: 'Failed to update invoices'
            });
        }

        // Recalculate balances after update
        const newSourceBalance = calculateInvoiceBalance(updatedSourceInvoice);
        const newDestinationBalance = calculateInvoiceBalance(updatedDestinationInvoice);

        // Update account amounts in main database
        const updatedAccounts = await Promise.all([
            Account.findOneAndUpdate(
                { accountNumber: sourceAccountNumber },
                { $set: { amount: Math.max(0, newSourceBalance) } },
                { new: true }
            ),
            Account.findOneAndUpdate(
                { accountNumber: destinationAccountNumber },
                { $set: { amount: Math.max(0, newDestinationBalance) } },
                { new: true }
            )
        ]);

        // Send confirmation messages if customer information is available
        try {
            // Format amount for better readability
            const formattedAmount = transferAmount.toFixed(2);
            const currencyCode = sourceInvoice.currency?.code || 'KES';

            // Notify source customer if different from destination
            if (sourceCustomer && 
                (!destinationCustomer || 
                 sourceCustomer._id?.toString() !== destinationCustomer._id?.toString())) {
                
                const phoneNumber = sourceCustomer.phoneNumber || sourceCustomer.phone;
                
                if (phoneNumber) {
                    // Process phone number
                    const phoneDigits = phoneNumber.replace(/\D/g, '');
                    const last9Digits = phoneDigits.slice(-9);

                    if (last9Digits.length === 9) {
                        const sourceMessage = `${currencyCode} ${formattedAmount} has been transferred from your Invoice #${sourceInvoice.invoiceNumber} to Invoice #${destinationInvoice.invoiceNumber}. Ref: ${transferId}`;
                        
                        sendMessageToQueue(
                            'Payserve',
                            last9Digits,
                            '',
                            sourceMessage,
                            'SMS Meliora'
                        );
                        
                        console.log(`Notification sent to source customer: ${last9Digits}`);
                    }
                }
            }

            // Notify destination customer
            if (destinationCustomer) {
                const phoneNumber = destinationCustomer.phoneNumber || destinationCustomer.phone;
                
                if (phoneNumber) {
                    // Process phone number
                    const phoneDigits = phoneNumber.replace(/\D/g, '');
                    const last9Digits = phoneDigits.slice(-9);

                    if (last9Digits.length === 9) {
                        const remainingBalText = newDestinationBalance > 0 ? 
                            `Remaining balance: ${currencyCode} ${newDestinationBalance.toFixed(2)}` : 
                            'Invoice fully paid';
                            
                        const destMessage = `Payment of ${currencyCode} ${formattedAmount} received for Invoice #${destinationInvoice.invoiceNumber}. ${remainingBalText}. Ref: ${transferId}`;
                        
                        sendMessageToQueue(
                            'Payserve',
                            last9Digits,
                            '',
                            destMessage,
                            'SMS Meliora'
                        );
                        
                        console.log(`Notification sent to destination customer: ${last9Digits}`);
                    }
                }
            }
        } catch (error) {
            console.error('Error sending notifications:', error);
            // Continue with the process even if notification fails
        }

        console.log('Credit transfer completed successfully');
        console.log('=== End: transfer_invoice_credit ===');

        return reply.code(200).send({
            success: true,
            message: 'Credit transfer completed successfully',
            data: {
                transferId,
                transferAmount,
                transferType,
                sourceInvoice: {
                    invoiceNumber: updatedSourceInvoice.invoiceNumber,
                    accountNumber: sourceAccountNumber,
                    previousBalance: sourceBalance,
                    newBalance: newSourceBalance,
                    status: updatedSourceInvoice.status,
                    customer: sourceCustomer ? {
                        name: sourceCustomer.name || `${sourceCustomer.firstName || ''} ${sourceCustomer.lastName || ''}`.trim(),
                        phoneNumber: sourceCustomer.phoneNumber || sourceCustomer.phone,
                        email: sourceCustomer.email
                    } : null
                },
                destinationInvoice: {
                    invoiceNumber: updatedDestinationInvoice.invoiceNumber,
                    accountNumber: destinationAccountNumber,
                    previousBalance: destinationBalance,
                    newBalance: newDestinationBalance,
                    status: updatedDestinationInvoice.status,
                    paymentCompletion: destinationReconciliationEntry.paymentCompletion,
                    customer: destinationCustomer ? {
                        name: destinationCustomer.name || `${destinationCustomer.firstName || ''} ${destinationCustomer.lastName || ''}`.trim(),
                        phoneNumber: destinationCustomer.phoneNumber || destinationCustomer.phone,
                        email: destinationCustomer.email
                    } : null
                }
            }
        });

    } catch (error) {
        console.error('Error processing credit transfer:', error);
        console.error('Error stack:', error.stack);
        return reply.code(500).send({
            success: false,
            error: error.message || 'Error processing credit transfer'
        });
    } finally {
        console.log('=== End: transfer_invoice_credit ===');
    }
};

module.exports = transfer_credit;