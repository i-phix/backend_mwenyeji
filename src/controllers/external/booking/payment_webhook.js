const crypto = require('crypto');
const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const { sendSms } = require('../../../utils/send_new_sms');
const { generateBookingInvoicePDF } = require('./generateBookingInvoicePDF');
const { sendBookingEmail } = require('./sendBookingEmail');

/**
 * Payment Webhook for External Booking API
 * Receives payment status updates and updates booking/invoice accordingly
 * Uses HMAC-SHA256 signature verification for security
 */
const payment_webhook = async (request, reply) => {
    try {
        // Webhook doesn't use standard API key auth - uses signature verification instead
        const signature = request.headers['x-webhook-signature'];
        const webhookSecret = process.env.WEBHOOK_SECRET || 'your-webhook-secret-change-in-production';

        // Verify webhook signature
        if (!signature) {
            return reply.code(401).send({
                success: false,
                error: 'Missing signature',
                message: 'Webhook signature is required'
            });
        }

        // Calculate expected signature
        const payload = JSON.stringify(request.body);
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(payload)
            .digest('hex');

        // Compare signatures (constant-time comparison to prevent timing attacks)
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
            console.warn('Webhook signature verification failed');
            return reply.code(401).send({
                success: false,
                error: 'Invalid signature',
                message: 'Webhook signature verification failed'
            });
        }

        // Extract webhook data
        const {
            event_type,
            booking_reference,
            invoice_number,
            payment_data,
            facility_id
        } = request.body;

        // Validate required fields
        if (!event_type || !booking_reference || !invoice_number || !facility_id) {
            return reply.code(400).send({
                success: false,
                error: 'Missing required fields',
                message: 'event_type, booking_reference, invoice_number, and facility_id are required'
            });
        }

        console.log(`Webhook received: ${event_type} for booking ${booking_reference}`);

        // Get models
        const BookingReservation = await getModel('BookingReservation', payservedb.BookingReservation.schema, facility_id);
        const BookingInvoice = await getModel('BookingInvoice', payservedb.BookingInvoice.schema, facility_id);

        // Fetch reservation
        const reservation = await BookingReservation.findOne({
            reservationId: booking_reference
        });

        if (!reservation) {
            return reply.code(404).send({
                success: false,
                error: 'Booking not found',
                message: `No booking found with reference: ${booking_reference}`
            });
        }

        // Fetch invoice
        const invoice = await BookingInvoice.findOne({
            $or: [
                { invoiceNumber: invoice_number },
                { invoiceId: invoice_number }
            ]
        });

        if (!invoice) {
            return reply.code(404).send({
                success: false,
                error: 'Invoice not found',
                message: `No invoice found with number: ${invoice_number}`
            });
        }

        // Handle different event types
        let updateResult = null;

        switch (event_type) {
            case 'payment.completed':
                updateResult = await handlePaymentCompleted(
                    reservation,
                    invoice,
                    payment_data,
                    BookingReservation,
                    BookingInvoice
                );
                break;

            case 'payment.failed':
                updateResult = await handlePaymentFailed(
                    reservation,
                    invoice,
                    payment_data,
                    BookingInvoice
                );
                break;

            case 'payment.pending':
                updateResult = await handlePaymentPending(
                    reservation,
                    invoice,
                    payment_data,
                    BookingInvoice
                );
                break;

            case 'booking.canceled':
                updateResult = await handleBookingCanceled(
                    reservation,
                    invoice,
                    payment_data,
                    BookingReservation,
                    BookingInvoice
                );
                break;

            default:
                return reply.code(400).send({
                    success: false,
                    error: 'Unsupported event type',
                    message: `Event type '${event_type}' is not supported`,
                    supported_events: ['payment.completed', 'payment.failed', 'payment.pending', 'booking.canceled']
                });
        }

        // Build response
        return reply.code(200).send({
            success: true,
            message: `Webhook processed successfully: ${event_type}`,
            data: {
                booking_reference: booking_reference,
                invoice_number: invoice_number,
                event_type: event_type,
                processed_at: new Date().toISOString(),
                result: updateResult
            }
        });

    } catch (error) {
        console.error('Error in payment_webhook (external API):', error);
        return reply.code(500).send({
            success: false,
            error: 'Internal server error',
            message: 'An error occurred while processing the webhook'
        });
    }
};

/**
 * Handle payment completed event
 */
async function handlePaymentCompleted(reservation, invoice, paymentData, BookingReservation, BookingInvoice) {
    const {
        amount,
        payment_method,
        transaction_id,
        payment_date,
        facility_id
    } = paymentData;

    // Add payment to invoice history
    const paymentHistoryEntry = {
        amount: parseFloat(amount),
        paymentMethod: payment_method || 'external',
        transactionId: transaction_id || '',
        date: payment_date ? new Date(payment_date) : new Date(),
        notes: `Payment via external API - ${transaction_id || 'No transaction ID'}`,
        recordedAt: new Date()
    };

    invoice.paymentHistory.push(paymentHistoryEntry);

    // Calculate new totals
    const totalPaid = invoice.paymentHistory.reduce((sum, p) => sum + p.amount, 0);
    const balance = invoice.totalAmount - totalPaid;

    // Update payment status
    let newPaymentStatus = 'Pending';
    if (balance <= 0) {
        newPaymentStatus = 'Paid';
    } else if (totalPaid > 0) {
        newPaymentStatus = 'Partially Paid';
    }

    invoice.paymentStatus = newPaymentStatus;
    await invoice.save();

    // Send invoice update for partial payments
    if (newPaymentStatus === 'Partially Paid' && reservation.guestInfo && reservation.guestInfo.email) {
        try {
            // Get property/unit/currency for PDF generation
            const BookingProperty = await getModel('BookingProperty', payservedb.BookingProperty.schema, facility_id || reservation.facilityId);
            const Unit = await getModel('Unit', payservedb.Unit.schema, facility_id || reservation.facilityId);
            const Currency = await getModel('Currency', payservedb.Currency.schema, facility_id || reservation.facilityId);

            const property = await BookingProperty.findById(reservation.bookingPropertyId);
            const unit = await Unit.findById(reservation.unitId);
            const currency = invoice.currencyId ? await Currency.findById(invoice.currencyId) : null;

            const pdfBuffer = await generateBookingInvoicePDF(
                invoice,
                reservation,
                property,
                unit,
                currency
            );

            const emailSubject = `Partial Payment Received - ${reservation.reservationId}`;
            const emailBody = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #ffc107; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                        <h2 style="margin: 0;">Partial Payment Received</h2>
                    </div>
                    <div style="padding: 20px;">
                        <p>Dear ${reservation.guestInfo.name},</p>
                        <p>We have received your partial payment of <strong>${currency?.currencyShortCode || 'KES'} ${parseFloat(amount).toFixed(2)}</strong> for booking ${reservation.reservationId}.</p>
                        <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                            <p style="margin: 0;"><strong>Remaining Balance: ${currency?.currencyShortCode || 'KES'} ${balance.toFixed(2)}</strong></p>
                            <p style="margin: 10px 0 0 0;">Please complete the remaining payment to confirm your booking.</p>
                        </div>
                        <p>Updated invoice is attached to this email.</p>
                        <p>Thank you!</p>
                    </div>
                </div>
            `;

            await sendBookingEmail(
                facility_id || reservation.facilityId,
                reservation.guestInfo.email,
                emailSubject,
                emailBody,
                [{
                    filename: `Invoice_${invoice.invoiceNumber || invoice.invoiceId}_PARTIAL.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }]
            );

            console.log(`Partial payment notification with PDF sent to ${reservation.guestInfo.email}`);
        } catch (partialEmailError) {
            console.error('Failed to send partial payment email:', partialEmailError);
        }
    }

    // Update reservation status to 'booked' if fully paid
    if (newPaymentStatus === 'Paid' && reservation.status === 'reserved') {
        reservation.status = 'booked';
        reservation.statusHistory.push({
            status: 'booked',
            timestamp: new Date(),
            notes: 'Payment completed via external API'
        });
        await reservation.save();

        console.log(`Reservation ${reservation.reservationId} status updated to 'booked'`);

        // Send SMS confirmation for successful payment
        try {
            if (reservation.guestInfo && reservation.guestInfo.phone) {
                const smsMessage = `Payment confirmed! Your booking at ${reservation.bookingPropertyId} is now CONFIRMED (${reservation.reservationId}). Check-in: ${reservation.checkIn.toISOString().split('T')[0]}. Amount paid: ${totalPaid}. See you soon!`;

                await sendSms(
                    facility_id || reservation.facilityId,
                    reservation.guestInfo.phone,
                    smsMessage
                );

                console.log(`Payment confirmation SMS sent to ${reservation.guestInfo.phone}`);
            }
        } catch (smsError) {
            console.error('Failed to send payment confirmation SMS:', smsError);
        }

        // Send email confirmation for successful payment
        try {
            if (reservation.guestInfo && reservation.guestInfo.email) {
                // Get property details for better email
                const BookingProperty = await getModel('BookingProperty', payservedb.BookingProperty.schema, facility_id || reservation.facilityId);
                const Unit = await getModel('Unit', payservedb.Unit.schema, facility_id || reservation.facilityId);
                const Currency = await getModel('Currency', payservedb.Currency.schema, facility_id || reservation.facilityId);

                const property = await BookingProperty.findById(reservation.bookingPropertyId);
                const unit = await Unit.findById(reservation.unitId);
                const currency = invoice.currencyId ? await Currency.findById(invoice.currencyId) : null;

                const emailSubject = `Booking Confirmed - Payment Received - ${reservation.reservationId}`;
                const emailBody = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #28a745; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                            <h2 style="margin: 0;">✓ Booking Confirmed!</h2>
                        </div>

                        <div style="padding: 20px; background-color: #f9f9f9;">
                            <p>Dear ${reservation.guestInfo.name},</p>

                            <p>Great news! Your payment has been received and your booking is now <strong style="color: #28a745;">CONFIRMED</strong>.</p>

                            <div style="background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                <h3 style="margin-top: 0; color: #333; border-bottom: 2px solid #28a745; padding-bottom: 10px;">Booking Details</h3>
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td style="padding: 8px 0; color: #666;">Booking Reference:</td>
                                        <td style="padding: 8px 0; font-weight: bold;">${reservation.reservationId}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #666;">Invoice Number:</td>
                                        <td style="padding: 8px 0; font-weight: bold;">${invoice.invoiceNumber || invoice.invoiceId}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #666;">Property:</td>
                                        <td style="padding: 8px 0; font-weight: bold;">${property?.propertyName || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #666;">Unit:</td>
                                        <td style="padding: 8px 0; font-weight: bold;">${unit?.name || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #666;">Check-in:</td>
                                        <td style="padding: 8px 0; font-weight: bold;">${reservation.checkIn.toISOString().split('T')[0]}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #666;">Check-out:</td>
                                        <td style="padding: 8px 0; font-weight: bold;">${reservation.checkOut.toISOString().split('T')[0]}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #666;">Guests:</td>
                                        <td style="padding: 8px 0; font-weight: bold;">${reservation.numberOfGuests?.adults || 0} Adult(s), ${reservation.numberOfGuests?.children || 0} Child(ren)</td>
                                    </tr>
                                </table>
                            </div>

                            <div style="background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                <h3 style="margin-top: 0; color: #333; border-bottom: 2px solid #28a745; padding-bottom: 10px;">Payment Summary</h3>
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td style="padding: 8px 0; color: #666;">Amount Paid:</td>
                                        <td style="padding: 8px 0; font-weight: bold; color: #28a745;">${currency?.currencyShortCode || 'KES'} ${totalPaid.toFixed(2)}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #666;">Payment Method:</td>
                                        <td style="padding: 8px 0; font-weight: bold;">${payment_method?.toUpperCase() || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #666;">Transaction ID:</td>
                                        <td style="padding: 8px 0; font-weight: bold;">${transaction_id || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #666;">Payment Date:</td>
                                        <td style="padding: 8px 0; font-weight: bold;">${new Date(payment_date).toLocaleString()}</td>
                                    </tr>
                                    <tr style="border-top: 2px solid #ddd;">
                                        <td style="padding: 8px 0; color: #666; font-size: 16px;">Balance:</td>
                                        <td style="padding: 8px 0; font-weight: bold; font-size: 16px; color: ${balance > 0 ? '#ff6600' : '#28a745'};">${currency?.currencyShortCode || 'KES'} ${balance.toFixed(2)}</td>
                                    </tr>
                                </table>
                            </div>

                            ${reservation.specialRequests ? `
                            <div style="background-color: #e7f3ff; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0;">
                                <p style="margin: 0;"><strong>Special Requests:</strong></p>
                                <p style="margin: 5px 0 0 0;">${reservation.specialRequests}</p>
                            </div>
                            ` : ''}

                            <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
                                <p style="margin: 0;"><strong>Next Steps:</strong></p>
                                <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                                    <li>You will receive check-in details 24 hours before arrival</li>
                                    <li>Keep this booking reference handy: <strong>${reservation.reservationId}</strong></li>
                                    <li>For any questions, contact us with your booking reference</li>
                                </ul>
                            </div>

                            <p>We look forward to welcoming you!</p>

                            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

                            <p style="font-size: 12px; color: #999; text-align: center;">This is an automated confirmation email. Please keep it for your records.</p>
                        </div>
                    </div>
                `;

                // Generate updated PDF invoice with payment details
                const pdfBuffer = await generateBookingInvoicePDF(
                    invoice,
                    reservation,
                    property,
                    unit,
                    currency
                );

                await sendBookingEmail(
                    facility_id || reservation.facilityId,
                    reservation.guestInfo.email,
                    emailSubject,
                    emailBody,
                    [
                        {
                            filename: `Invoice_${invoice.invoiceNumber || invoice.invoiceId}_PAID.pdf`,
                            content: pdfBuffer,
                            contentType: 'application/pdf'
                        }
                    ]
                );

                console.log(`Payment confirmation email with PDF invoice sent to ${reservation.guestInfo.email}`);
            }
        } catch (emailError) {
            console.error('Failed to send payment confirmation email:', emailError);
        }
    }

    return {
        payment_status: newPaymentStatus,
        amount_paid: totalPaid,
        balance: balance,
        reservation_status: reservation.status
    };
}

/**
 * Handle payment failed event
 */
async function handlePaymentFailed(reservation, invoice, paymentData, BookingInvoice) {
    const {
        transaction_id,
        failure_reason
    } = paymentData;

    // Add note to invoice (optional: could add failed payment attempts array)
    invoice.notes = invoice.notes || '';
    invoice.notes += `\n[${new Date().toISOString()}] Payment failed: ${failure_reason || 'Unknown reason'} (Transaction: ${transaction_id || 'N/A'})`;
    await invoice.save();

    console.log(`Payment failed for invoice ${invoice.invoiceNumber}: ${failure_reason}`);

    return {
        payment_status: invoice.paymentStatus,
        failure_reason: failure_reason || 'Unknown'
    };
}

/**
 * Handle payment pending event
 */
async function handlePaymentPending(reservation, invoice, paymentData, BookingInvoice) {
    const {
        transaction_id
    } = paymentData;

    // Add note about pending payment
    invoice.notes = invoice.notes || '';
    invoice.notes += `\n[${new Date().toISOString()}] Payment pending verification (Transaction: ${transaction_id || 'N/A'})`;
    await invoice.save();

    console.log(`Payment pending for invoice ${invoice.invoiceNumber}`);

    return {
        payment_status: invoice.paymentStatus,
        transaction_id: transaction_id || null
    };
}

/**
 * Handle booking canceled event
 */
async function handleBookingCanceled(reservation, invoice, paymentData, BookingReservation, BookingInvoice) {
    const {
        cancellation_reason,
        refund_amount
    } = paymentData;

    // Update reservation status
    reservation.status = 'canceled';
    reservation.statusHistory.push({
        status: 'canceled',
        timestamp: new Date(),
        notes: `Canceled via external API: ${cancellation_reason || 'No reason provided'}`
    });
    await reservation.save();

    // Update invoice status
    invoice.status = 'cancelled';
    invoice.notes = invoice.notes || '';
    invoice.notes += `\n[${new Date().toISOString()}] Booking canceled: ${cancellation_reason || 'No reason provided'}`;

    if (refund_amount && refund_amount > 0) {
        invoice.notes += `\nRefund amount: ${refund_amount}`;
    }

    await invoice.save();

    console.log(`Booking ${reservation.reservationId} canceled via webhook`);

    return {
        reservation_status: 'canceled',
        refund_amount: refund_amount || 0,
        cancellation_reason: cancellation_reason || 'No reason provided'
    };
}

module.exports = payment_webhook;
