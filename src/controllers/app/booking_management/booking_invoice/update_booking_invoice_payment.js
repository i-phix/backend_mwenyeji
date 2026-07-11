const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const { v4: uuidv4 } = require('uuid');

/**
 * Update payment for a booking invoice
 * Creates a CashPayment record that requires approval for manual payments
 */
const update_invoice_payment = async (request, reply) => {
    try {
        const { facilityId, invoiceId } = request.params;
        const {
            amount,
            paymentMethod,
            transactionId,
            notes,
            paymentDate,
            receiptNumber
        } = request.body;

        const user = request.user;

        // Validate required fields
        if (!amount || amount <= 0) {
            return reply.code(400).send({
                success: false,
                error: 'Payment amount is required and must be greater than 0'
            });
        }

        if (!paymentMethod) {
            return reply.code(400).send({
                success: false,
                error: 'Payment method is required'
            });
        }

        if (!receiptNumber) {
            return reply.code(400).send({
                success: false,
                error: 'Receipt number is required'
            });
        }

        // Get models with facility context
        const BookingInvoice = await getModel('BookingInvoice', payservedb.BookingInvoice.schema, facilityId);
        const CashPayment = await getModel('CashPayment', payservedb.CashPayment.schema, facilityId);
        const Currency = await getModel('Currency', payservedb.Currency.schema, facilityId);

        // Find invoice by ID or invoice number
        let invoice;
        if (mongoose.Types.ObjectId.isValid(invoiceId)) {
            invoice = await BookingInvoice.findOne({
                _id: invoiceId,
                facilityId
            });
        } else {
            // Try to find by invoice number or invoice ID string
            invoice = await BookingInvoice.findOne({
                $or: [
                    { invoiceNumber: invoiceId },
                    { invoiceId: invoiceId }
                ],
                facilityId
            });
        }

        if (!invoice) {
            return reply.code(404).send({
                success: false,
                error: 'Invoice not found'
            });
        }

        // Check if invoice is in a valid state for payment
        if (invoice.status === 'cancelled' || invoice.status === 'void') {
            return reply.code(400).send({
                success: false,
                error: `Cannot add payment to an invoice with status: ${invoice.status}`
            });
        }

        // Check for duplicate receipt number
        const existingPayment = await CashPayment.findOne({ receiptNumber });
        if (existingPayment) {
            return reply.code(400).send({
                success: false,
                error: `Receipt number ${receiptNumber} already exists`
            });
        }

        // Get currency details
        const currency = await Currency.findById(invoice.currencyId);
        if (!currency) {
            return reply.code(404).send({
                success: false,
                error: 'Currency not found for this invoice'
            });
        }

        // Get facility details
        const Facility = payservedb.Facility;
        const facility = await Facility.findById(facilityId);
        if (!facility) {
            return reply.code(404).send({
                success: false,
                error: 'Facility not found'
            });
        }

        // Map payment method to schema enum
        const mapPaymentMethod = (method) => {
            if (!method) return 'cash';
            const methodLower = method.toLowerCase();
            switch (methodLower) {
                case 'cash': return 'cash';
                case 'bank transfer': return 'bank-transfer';
                case 'cheque':
                case 'check': return 'cheque';
                case 'card': return 'card';
                case 'mobile money':
                case 'mpesa':
                case 'm-pesa': return 'mpesa';
                default: return 'cash';
            }
        };

        // Create payment reference
        const paymentReference = `BOOKING-${uuidv4().substring(0, 8)}`;

        // Create cash payment record for approval
        const guestName = invoice.guestInfo?.name || 'Guest';
        const guestParts = guestName.split(' ').filter(Boolean);
        const guestFirstName = guestParts[0] || 'Guest';
        const guestLastName = guestParts.slice(1).join(' ') || 'Guest';
        const createdByUserId = user?._id || facility._id;

        const cashPaymentData = {
            paymentReference,
            receiptNumber,
            invoice: {
                invoiceId: invoice._id,
                invoiceNumber: invoice.invoiceNumber || invoice.invoiceId,
                accountNumber: invoice.accountNumber || invoice.invoiceId || invoice.invoiceNumber,
                invoiceType: 'booking'
            },
            client: {
                clientId: new mongoose.Types.ObjectId(), // Guest doesn't have a customer ID
                firstName: guestFirstName,
                lastName: guestLastName
            },
            facility: {
                id: facility._id,
                name: facility.name
            },
            paymentAmount: parseFloat(amount),
            currency: {
                id: currency._id,
                name: currency.currencyName,
                code: currency.currencyShortCode
            },
            paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
            receivedBy: user ? new mongoose.Types.ObjectId(user._id) : null,
            paymentMethod: mapPaymentMethod(paymentMethod),
            paymentDetails: {
                notes: notes || '',
                transactionId: transactionId || ''
            },
            approvalStatus: 'Pending',
            reconciliationStatus: 'Pending',
            metadata: {
                createdBy: new mongoose.Types.ObjectId(createdByUserId),
                source: 'manual',
                deviceInfo: {
                    deviceId: request.headers['user-agent'] || 'Unknown',
                    ipAddress: request.ip || 'Unknown'
                }
            },
            paymentNotes: `Booking Invoice Payment${notes ? ': ' + notes : ''}`
        };

        const newCashPayment = new CashPayment(cashPaymentData);
        await newCashPayment.save();

        console.log(`Cash payment created for booking invoice ${invoice.invoiceNumber}: ${paymentReference}`);

        return reply.code(200).send({
            success: true,
            message: `Payment recorded successfully. Pending approval in Finance Management.`,
            data: {
                paymentReference: paymentReference,
                receiptNumber: receiptNumber,
                amount: parseFloat(amount),
                approvalStatus: 'Pending',
                invoiceNumber: invoice.invoiceId || invoice.invoiceNumber
            }
        });

    } catch (error) {
        console.error('Error updating invoice payment:', error);
        return reply.code(500).send({
            success: false,
            error: error.message || 'An unexpected error occurred while updating payment',
            debug: {
                facilityId: request.params.facilityId,
                invoiceId: request.params.invoiceId,
                errorStack: error.stack
            }
        });
    }
};

module.exports = update_invoice_payment;
