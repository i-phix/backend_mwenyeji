const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

/**
 * Get Booking Status for External Booking API
 * Returns current status of a booking including payment status
 */
const get_booking_status = async (request, reply) => {
    try {
        const { booking_reference } = request.params;
        const facility_id = request.query.facility_id;

        if (!booking_reference) {
            return reply.code(400).send({
                success: false,
                error: 'Missing booking reference',
                message: 'Booking reference is required'
            });
        }

        if (!facility_id) {
            return reply.code(400).send({
                success: false,
                error: 'Missing facility ID',
                message: 'facility_id is required as a query parameter'
            });
        }

        const facilityId = facility_id;

        // Get models
        const BookingReservation = await getModel('BookingReservation', payservedb.BookingReservation.schema, facilityId);
        const BookingInvoice = await getModel('BookingInvoice', payservedb.BookingInvoice.schema, facilityId);
        const BookingProperty = await getModel('BookingProperty', payservedb.BookingProperty.schema, facilityId);
        const Unit = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const Currency = await getModel('Currency', payservedb.Currency.schema, facilityId);

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
                message: `No booking found with reference: ${booking_reference}`
            });
        }

        // Fetch related invoice
        const invoice = await BookingInvoice.findOne({
            bookingReservationId: reservation._id
        });

        if (!invoice) {
            return reply.code(404).send({
                success: false,
                error: 'Invoice not found',
                message: 'No invoice found for this booking'
            });
        }

        // Fetch property and unit details
        const property = await BookingProperty.findById(reservation.bookingPropertyId);
        const unit = await Unit.findById(reservation.unitId);

        // Get currency details
        let currency = { code: 'USD', name: 'US Dollar' };
        if (invoice.currencyId) {
            const curr = await Currency.findById(invoice.currencyId);
            if (curr) {
                currency = {
                    code: curr.currencyShortCode,
                    name: curr.currencyName,
                    exchange_rate: curr.exchangeRate
                };
            }
        }

        // Calculate payment totals
        const totalAmount = invoice.totalAmount;
        const amountPaid = invoice.paymentHistory?.reduce((sum, p) => sum + p.amount, 0) || 0;
        const balance = totalAmount - amountPaid;

        // Determine overall booking status
        let bookingStatus = reservation.status;
        let bookingStatusMessage = '';

        switch (reservation.status) {
            case 'reserved':
                if (invoice.paymentStatus === 'Paid') {
                    bookingStatusMessage = 'Reservation is pending confirmation';
                } else if (invoice.paymentStatus === 'Partially Paid') {
                    bookingStatusMessage = 'Reservation active. Payment pending to confirm booking.';
                } else {
                    bookingStatusMessage = 'Reservation active. Payment required to confirm booking.';
                }
                break;
            case 'booked':
                bookingStatusMessage = 'Booking confirmed and paid';
                break;
            case 'checked-in':
                bookingStatusMessage = 'Guest has checked in';
                break;
            case 'checked-out':
                bookingStatusMessage = 'Guest has checked out';
                break;
            case 'completed':
                bookingStatusMessage = 'Booking completed';
                break;
            case 'canceled':
                bookingStatusMessage = 'Booking has been canceled';
                break;
            default:
                bookingStatusMessage = `Booking status: ${reservation.status}`;
        }

        // Build payment history
        const paymentHistory = (invoice.paymentHistory || []).map(payment => ({
            amount: payment.amount,
            payment_method: payment.paymentMethod,
            transaction_id: payment.transactionId || '',
            date: payment.date ? payment.date.toISOString() : null,
            notes: payment.notes || ''
        }));

        // Build response
        const response = {
            success: true,
            message: bookingStatusMessage,
            data: {
                booking_reference: reservation.reservationId,
                status: bookingStatus,
                created_at: reservation.createdAt ? reservation.createdAt.toISOString() : null,
                property: {
                    id: property?._id.toString(),
                    name: property?.propertyName,
                    type: property?.propertyType
                },
                unit: {
                    id: unit?._id.toString(),
                    name: unit?.name,
                    type: unit?.unitType
                },
                guest_info: {
                    name: reservation.guestInfo.name,
                    email: reservation.guestInfo.email,
                    phone: reservation.guestInfo.phone
                },
                stay_period: {
                    check_in: reservation.checkIn.toISOString().split('T')[0],
                    check_out: reservation.checkOut.toISOString().split('T')[0],
                    nights: invoice.stayPeriod?.nights || 0
                },
                guests: {
                    adults: reservation.numberOfGuests?.adults || 0,
                    children: reservation.numberOfGuests?.children || 0,
                    total: (reservation.numberOfGuests?.adults || 0) + (reservation.numberOfGuests?.children || 0)
                },
                payment: {
                    invoice_number: invoice.invoiceNumber || invoice.invoiceId,
                    account_number: invoice.accountNumber || null, // M-Pesa account number for payment
                    total_amount: totalAmount,
                    amount_paid: amountPaid,
                    balance: balance,
                    payment_status: invoice.paymentStatus,
                    currency: currency.code,
                    currency_details: currency,
                    payment_history: paymentHistory
                },
                special_requests: reservation.specialRequests || '',
                cancellation_policy: property?.cancellationPolicy || 'Standard cancellation policy applies'
            },
            warnings: []
        };

        // Add warnings for unpaid/partially paid reservations
        if (reservation.status === 'reserved' && invoice.paymentStatus !== 'Paid') {
            response.warnings.push({
                type: 'payment_required',
                message: 'Payment is required to confirm this booking. Unpaid reservations may be reassigned and cancellation policies will apply.',
                severity: 'high'
            });
        }

        return reply.code(200).send(response);

    } catch (error) {
        console.error('Error in get_booking_status (external API):', error);
        return reply.code(500).send({
            success: false,
            error: 'Internal server error',
            message: 'An error occurred while retrieving booking status'
        });
    }
};

module.exports = get_booking_status;
