const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const { sendSms } = require('../../../utils/send_new_sms');
const { generateBookingInvoicePDF } = require('./generateBookingInvoicePDF');
const { sendBookingEmail } = require('./sendBookingEmail');

/**
 * Handle M-Pesa payment for booking invoices
 * Called by mpesa-production service after successful M-Pesa transaction
 * URL: /api/external/booking/mpesa-payment
 */
const mpesa_payment = async (request, reply) => {
    try {
        console.log('[Booking M-Pesa Payment] Received payment data:', request.body);

        const {
            accountNumber,
            amount,
            mpesaReceiptNumber,
            msisdn,
            firstName,
            middleName,
            lastName,
            transactionDate,
            facilityId: callbackFacilityId,
            customerId: callbackCustomerId,
            uniqueIdentifier
        } = request.body;

        // Validate required fields
        if (!accountNumber || !amount) {
            return reply.code(400).send({
                success: false,
                error: 'Missing required fields',
                message: 'accountNumber and amount are required'
            });
        }

        const paymentAmount = parseFloat(amount);
        const receiptNumber = mpesaReceiptNumber || `MPESA-${Date.now()}`;

        console.log(`[Booking M-Pesa Payment] Processing payment for account: ${accountNumber}, amount: ${paymentAmount}`);

        // Find the Account entry to get facility ID and invoice number
        const Account = payservedb.Account;
        const account = await Account.findOne({ accountNumber });

        if (!account) {
            console.error(`[Booking M-Pesa Payment] Account not found: ${accountNumber}`);
            return reply.code(404).send({
                success: false,
                error: 'Account not found',
                message: `No account found with number: ${accountNumber}`
            });
        }

        const facilityId = callbackFacilityId || account.facilityId;
        console.log(`[Booking M-Pesa Payment] Found account for facility: ${facilityId}`);

        // Get models with facility context
        const BookingInvoice = await getModel('BookingInvoice', payservedb.BookingInvoice.schema, facilityId);
        const BookingReservation = await getModel('BookingReservation', payservedb.BookingReservation.schema, facilityId);
        const BookingProperty = await getModel('BookingProperty', payservedb.BookingProperty.schema, facilityId);
        const Unit = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const Currency = await getModel('Currency', payservedb.Currency.schema, facilityId);

        // Find the booking invoice by accountNumber field
        const invoice = await BookingInvoice.findOne({
            accountNumber: accountNumber,
            facilityId
        });

        if (!invoice) {
            console.error(`[Booking M-Pesa Payment] Invoice not found for account: ${accountNumber}`);
            return reply.code(404).send({
                success: false,
                error: 'Invoice not found',
                message: `No booking invoice found with account number: ${accountNumber}`
            });
        }

        console.log(`[Booking M-Pesa Payment] Found invoice: ${invoice.invoiceNumber || invoice.invoiceId} for account: ${accountNumber}`);

        // Check if payment already recorded (duplicate prevention)
        const existingPayment = invoice.paymentHistory.find(
            payment => payment.transactionId === receiptNumber
        );

        if (existingPayment) {
            console.log(`[Booking M-Pesa Payment] Duplicate payment detected: ${receiptNumber}`);
            return reply.code(200).send({
                success: true,
                message: 'Payment already recorded',
                data: {
                    invoiceNumber: invoice.invoiceNumber || invoice.invoiceId,
                    duplicate: true
                }
            });
        }

        // Add payment to history
        const customerName = [firstName, middleName, lastName].filter(Boolean).join(' ') || 'Guest';
        const paymentHistoryEntry = {
            amount: paymentAmount,
            paymentMethod: 'Mobile Money',
            transactionId: receiptNumber,
            date: transactionDate ? new Date(transactionDate) : new Date(),
            notes: `M-Pesa payment from ${customerName} (${msisdn || 'N/A'})`,
            recordedAt: new Date()
        };

        invoice.paymentHistory.push(paymentHistoryEntry);

        // Calculate new totals
        const totalPaid = invoice.paymentHistory.reduce((sum, p) => sum + p.amount, 0);
        const balance = invoice.totalAmount - totalPaid;

        console.log(`[Booking M-Pesa Payment] Payment calculation:
            Total amount: ${invoice.totalAmount}
            Payment received: ${paymentAmount}
            Total paid: ${totalPaid}
            Balance: ${balance}`);

        // Update payment status
        let newPaymentStatus = 'Pending';
        if (balance <= 0) {
            newPaymentStatus = 'Paid';
        } else if (totalPaid > 0) {
            newPaymentStatus = 'Partially Paid';
        }

        invoice.paymentStatus = newPaymentStatus;
        await invoice.save();

        console.log(`[Booking M-Pesa Payment] Invoice updated - Status: ${newPaymentStatus}`);

        // Update Account balance
        await Account.findOneAndUpdate(
            { accountNumber },
            { $set: { amount: Math.max(0, balance) } }
        );

        console.log(`[Booking M-Pesa Payment] Account balance updated: ${Math.max(0, balance)}`);

        // Find the associated booking reservation
        const reservation = await BookingReservation.findOne({
            $or: [
                { _id: invoice.bookingReservationId },
                { reservationId: invoice.bookingReservationId },
                { bookingReservationId: invoice.bookingReservationId }
            ]
        });

        if (!reservation) {
            console.warn(`[Booking M-Pesa Payment] Reservation not found for invoice: ${invoice.invoiceNumber}`);
        }

        // If fully paid, update reservation status to 'booked'
        if (newPaymentStatus === 'Paid' && reservation && reservation.status === 'reserved') {
            reservation.status = 'booked';
            reservation.statusHistory.push({
                status: 'booked',
                timestamp: new Date(),
                notes: `Payment completed via M-Pesa - Receipt: ${receiptNumber}`
            });
            await reservation.save();

            console.log(`[Booking M-Pesa Payment] Reservation status updated to 'booked': ${reservation.reservationId || reservation.bookingReservationId}`);

            // Send confirmation SMS
            if (reservation.guestInfo && reservation.guestInfo.phone) {
                try {
                    const property = await BookingProperty.findById(reservation.bookingPropertyId);
                    const smsMessage = `Payment confirmed! Your booking at ${property?.propertyName || 'our property'} is now CONFIRMED (${reservation.reservationId || reservation.bookingReservationId}). Check-in: ${reservation.checkIn.toISOString().split('T')[0]}. Amount paid: ${totalPaid}. Receipt: ${receiptNumber}. See you soon!`;

                    await sendSms(
                        facilityId,
                        reservation.guestInfo.phone,
                        smsMessage
                    );

                    console.log(`[Booking M-Pesa Payment] Confirmation SMS sent to ${reservation.guestInfo.phone}`);
                } catch (smsError) {
                    console.error('[Booking M-Pesa Payment] Failed to send confirmation SMS:', smsError);
                }
            }

            // Send confirmation email with PDF
            if (reservation.guestInfo && reservation.guestInfo.email) {
                try {
                    const property = await BookingProperty.findById(reservation.bookingPropertyId);
                    const unit = await Unit.findById(reservation.unitId);
                    const currency = invoice.currencyId ? await Currency.findById(invoice.currencyId) : null;

                    const emailSubject = `Booking Confirmed - Payment Received - ${reservation.reservationId || reservation.bookingReservationId}`;
                    const emailBody = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="background-color: #28a745; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                                <h2 style="margin: 0;">✓ Booking Confirmed!</h2>
                            </div>

                            <div style="padding: 20px; background-color: #f9f9f9;">
                                <p>Dear ${reservation.guestInfo.name},</p>

                                <p>Great news! Your M-Pesa payment has been received and your booking is now <strong style="color: #28a745;">CONFIRMED</strong>.</p>

                                <div style="background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                    <h3 style="margin-top: 0; color: #333; border-bottom: 2px solid #28a745; padding-bottom: 10px;">Booking Details</h3>
                                    <table style="width: 100%; border-collapse: collapse;">
                                        <tr>
                                            <td style="padding: 8px 0; color: #666;">Booking Reference:</td>
                                            <td style="padding: 8px 0; font-weight: bold;">${reservation.reservationId || reservation.bookingReservationId}</td>
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
                                            <td style="padding: 8px 0; font-weight: bold; color: #28a745;">${currency?.currencyShortCode || 'KES'} ${paymentAmount.toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 8px 0; color: #666;">Payment Method:</td>
                                            <td style="padding: 8px 0; font-weight: bold;">M-PESA</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 8px 0; color: #666;">Receipt Number:</td>
                                            <td style="padding: 8px 0; font-weight: bold;">${receiptNumber}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 8px 0; color: #666;">Payment Date:</td>
                                            <td style="padding: 8px 0; font-weight: bold;">${new Date().toLocaleString()}</td>
                                        </tr>
                                        <tr style="border-top: 2px solid #ddd;">
                                            <td style="padding: 8px 0; color: #666; font-size: 16px;">Total Paid:</td>
                                            <td style="padding: 8px 0; font-weight: bold; font-size: 16px; color: #28a745;">${currency?.currencyShortCode || 'KES'} ${totalPaid.toFixed(2)}</td>
                                        </tr>
                                        <tr>
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
                                        <li>Keep this booking reference handy: <strong>${reservation.reservationId || reservation.bookingReservationId}</strong></li>
                                        <li>For any questions, contact us with your booking reference</li>
                                    </ul>
                                </div>

                                <p>We look forward to welcoming you!</p>

                                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

                                <p style="font-size: 12px; color: #999; text-align: center;">This is an automated confirmation email. Please keep it for your records.</p>
                            </div>
                        </div>
                    `;

                    // Generate PDF invoice
                    const pdfBuffer = await generateBookingInvoicePDF(
                        invoice,
                        reservation,
                        property,
                        unit,
                        currency
                    );

                    await sendBookingEmail(
                        facilityId,
                        reservation.guestInfo.email,
                        emailSubject,
                        emailBody,
                        [{
                            filename: `Invoice_${invoice.invoiceNumber || invoice.invoiceId}_PAID.pdf`,
                            content: pdfBuffer,
                            contentType: 'application/pdf'
                        }]
                    );

                    console.log(`[Booking M-Pesa Payment] Confirmation email sent to ${reservation.guestInfo.email}`);
                } catch (emailError) {
                    console.error('[Booking M-Pesa Payment] Failed to send confirmation email:', emailError);
                }
            }
        } else if (newPaymentStatus === 'Partially Paid' && reservation && reservation.guestInfo && reservation.guestInfo.email) {
            // Send partial payment notification
            try {
                const property = await BookingProperty.findById(reservation.bookingPropertyId);
                const unit = await Unit.findById(reservation.unitId);
                const currency = invoice.currencyId ? await Currency.findById(invoice.currencyId) : null;

                const emailSubject = `Partial Payment Received - ${reservation.reservationId || reservation.bookingReservationId}`;
                const emailBody = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #ffc107; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                            <h2 style="margin: 0;">Partial Payment Received</h2>
                        </div>
                        <div style="padding: 20px;">
                            <p>Dear ${reservation.guestInfo.name},</p>
                            <p>We have received your partial M-Pesa payment of <strong>${currency?.currencyShortCode || 'KES'} ${paymentAmount.toFixed(2)}</strong> for booking ${reservation.reservationId || reservation.bookingReservationId}.</p>
                            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                                <p style="margin: 0;"><strong>Remaining Balance: ${currency?.currencyShortCode || 'KES'} ${balance.toFixed(2)}</strong></p>
                                <p style="margin: 10px 0 0 0;">Please complete the remaining payment to confirm your booking.</p>
                            </div>
                            <p>Receipt Number: <strong>${receiptNumber}</strong></p>
                            <p>Thank you!</p>
                        </div>
                    </div>
                `;

                const pdfBuffer = await generateBookingInvoicePDF(
                    invoice,
                    reservation,
                    property,
                    unit,
                    currency
                );

                await sendBookingEmail(
                    facilityId,
                    reservation.guestInfo.email,
                    emailSubject,
                    emailBody,
                    [{
                        filename: `Invoice_${invoice.invoiceNumber || invoice.invoiceId}_PARTIAL.pdf`,
                        content: pdfBuffer,
                        contentType: 'application/pdf'
                    }]
                );

                console.log(`[Booking M-Pesa Payment] Partial payment email sent to ${reservation.guestInfo.email}`);
            } catch (emailError) {
                console.error('[Booking M-Pesa Payment] Failed to send partial payment email:', emailError);
            }
        }

        return reply.code(200).send({
            success: true,
            message: newPaymentStatus === 'Paid'
                ? 'Payment received and booking confirmed'
                : `Partial payment received. Remaining balance: ${balance}`,
            data: {
                invoiceNumber: invoice.invoiceNumber || invoice.invoiceId,
                reservationId: reservation?.reservationId || reservation?.bookingReservationId,
                paymentAmount,
                totalPaid,
                balance,
                paymentStatus: newPaymentStatus,
                reservationStatus: reservation?.status,
                receiptNumber: receiptNumber
            }
        });

    } catch (error) {
        console.error('[Booking M-Pesa Payment] Error processing payment:', error);
        return reply.code(500).send({
            success: false,
            error: 'Internal server error',
            message: 'An error occurred while processing the M-Pesa payment'
        });
    }
};

module.exports = mpesa_payment;
