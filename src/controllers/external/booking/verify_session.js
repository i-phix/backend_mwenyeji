const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

/**
 * Verify Session Token for Payment Redirect
 * Validates JWT token and retrieves booking/invoice details for payment page
 */
const verify_session = async (request, reply) => {
    try {
        const { session_token } = request.body;

        if (!session_token) {
            return reply.code(400).send({
                success: false,
                error: 'Missing session token',
                message: 'Session token is required'
            });
        }

        // Verify JWT token
        const sessionSecret = process.env.SESSION_SECRET || 'your-session-secret-key-change-in-production';

        let sessionData;
        try {
            sessionData = jwt.verify(session_token, sessionSecret);
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return reply.code(401).send({
                    success: false,
                    error: 'Session expired',
                    message: 'This payment session has expired. Please create a new booking.'
                });
            }
            return reply.code(401).send({
                success: false,
                error: 'Invalid session',
                message: 'Invalid session token'
            });
        }

        // Extract data from token
        const {
            booking_reference,
            invoice_id,
            facility_id,
            amount,
            currency,
            guest_email,
            return_url
        } = sessionData;

        // Get models
        const BookingReservation = await getModel('BookingReservation', payservedb.BookingReservation.schema, facility_id);
        const BookingInvoice = await getModel('BookingInvoice', payservedb.BookingInvoice.schema, facility_id);
        const Currency = await getModel('Currency', payservedb.Currency.schema, facility_id);

        // Fetch reservation
        const reservation = await BookingReservation.findOne({
            $or: [
                { reservationId: booking_reference },
                { bookingReservationId: booking_reference }
            ]
        });

        if (!reservation) {
            return reply.code(404).send({
                success: false,
                error: 'Booking not found',
                message: 'No booking found with this reference'
            });
        }

        // Fetch invoice
        const invoice = await BookingInvoice.findOne({
            $or: [
                { invoiceNumber: invoice_id },
                { invoiceId: invoice_id }
            ]
        });

        if (!invoice) {
            return reply.code(404).send({
                success: false,
                error: 'Invoice not found',
                message: 'No invoice found for this booking'
            });
        }

        // Check if already paid
        if (invoice.paymentStatus === 'Paid') {
            return reply.code(400).send({
                success: false,
                error: 'Already paid',
                message: 'This invoice has already been paid',
                paid: true
            });
        }

        // Get currency details
        let currencyDetails = { code: currency || 'USD', name: 'US Dollar' };
        if (invoice.currencyId) {
            const curr = await Currency.findById(invoice.currencyId);
            if (curr) {
                currencyDetails = {
                    code: curr.currencyShortCode,
                    name: curr.currencyName,
                    exchange_rate: curr.exchangeRate
                };
            }
        }

        // Build response with booking and payment details
        const response = {
            success: true,
            message: 'Session verified successfully',
            data: {
                booking_reference: reservation.reservationId,
                invoice_number: invoice.invoiceNumber || invoice.invoiceId,
                status: reservation.status,
                guest_info: {
                    name: reservation.guestInfo.name,
                    email: reservation.guestInfo.email,
                    phone: reservation.guestInfo.phone
                },
                stay_period: {
                    check_in: reservation.checkIn.toISOString().split('T')[0],
                    check_out: reservation.checkOut.toISOString().split('T')[0],
                    nights: invoice.stayPeriod?.nights || Math.ceil((reservation.checkOut - reservation.checkIn) / (1000 * 60 * 60 * 24))
                },
                pricing: {
                    total_amount: invoice.totalAmount,
                    amount_paid: invoice.paymentHistory?.reduce((sum, p) => sum + p.amount, 0) || 0,
                    balance: invoice.totalAmount - (invoice.paymentHistory?.reduce((sum, p) => sum + p.amount, 0) || 0),
                    currency: currencyDetails.code,
                    currency_details: currencyDetails
                },
                payment_status: invoice.paymentStatus,
                return_url: return_url || null,
                facility_id: facility_id
            }
        };

        return reply.code(200).send(response);

    } catch (error) {
        console.error('Error in verify_session (external API):', error);
        return reply.code(500).send({
            success: false,
            error: 'Internal server error',
            message: 'An error occurred while verifying the session'
        });
    }
};

module.exports = verify_session;
