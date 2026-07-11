const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendSms } = require('../../../utils/send_new_sms');
const { generateBookingInvoicePDF } = require('./generateBookingInvoicePDF');
const { sendBookingEmail } = require('./sendBookingEmail');

/**
 * Create Booking for External Booking API
 * Wrapper around internal create_reservation logic
 */
const create_booking = async (request, reply) => {
    try {
        const {
            facility_id,
            property_id,
            unit_id,
            check_in_date,
            check_out_date,
            guest_info,
            special_requests,
            return_url
        } = request.body;

        // Validate facility_id
        if (!facility_id) {
            return reply.code(400).send({
                success: false,
                error: 'Missing facility ID',
                message: 'facility_id is required in request body'
            });
        }

        const facilityId = facility_id;

        // Validate required fields
        if (!property_id || !unit_id || !check_in_date || !check_out_date) {
            return reply.code(400).send({
                success: false,
                error: 'Missing required fields',
                message: 'property_id, unit_id, check_in_date, and check_out_date are required',
                required_fields: ['property_id', 'unit_id', 'check_in_date', 'check_out_date']
            });
        }

        if (!guest_info || !guest_info.name || !guest_info.email || !guest_info.phone) {
            return reply.code(400).send({
                success: false,
                error: 'Missing guest information',
                message: 'Guest name, email, and phone are required',
                required_fields: ['guest_info.name', 'guest_info.email', 'guest_info.phone']
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(guest_info.email)) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid email format',
                message: 'Please provide a valid email address'
            });
        }

        // Validate and format phone number (must include country prefix)
        const phoneRegex = /^\+\d{1,4}\d{6,14}$/;
        let formattedPhone = guest_info.phone.trim();

        // Remove spaces, dashes, parentheses
        formattedPhone = formattedPhone.replace(/[\s\-\(\)]/g, '');

        // If phone doesn't start with +, reject it
        if (!formattedPhone.startsWith('+')) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid phone format',
                message: 'Phone number must include country prefix (e.g., +254700123456)',
                example: '+254700123456'
            });
        }

        // Validate phone format
        if (!phoneRegex.test(formattedPhone)) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid phone format',
                message: 'Phone number format is invalid. Must be in international format with country code.',
                example: '+254700123456'
            });
        }

        // Validate guest name (no numbers or special chars)
        const nameRegex = /^[a-zA-Z\s\-']{2,100}$/;
        if (!nameRegex.test(guest_info.name)) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid name format',
                message: 'Guest name must contain only letters, spaces, hyphens, and apostrophes (2-100 characters)'
            });
        }

        // Validate adults count
        if (guest_info.adults && (guest_info.adults < 1 || guest_info.adults > 20)) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid guest count',
                message: 'Number of adults must be between 1 and 20'
            });
        }

        // Validate children count
        if (guest_info.children && (guest_info.children < 0 || guest_info.children > 20)) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid guest count',
                message: 'Number of children must be between 0 and 20'
            });
        }

        // Validate date format and logic
        const checkIn = new Date(check_in_date);
        const checkOut = new Date(check_out_date);

        if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid date format',
                message: 'Dates must be in YYYY-MM-DD format'
            });
        }

        if (checkOut <= checkIn) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid date range',
                message: 'Check-out date must be after check-in date'
            });
        }

        // Check if dates are in the past
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (checkIn < today) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid date',
                message: 'Check-in date cannot be in the past'
            });
        }

        // Get models
        const BookingProperty = await getModel('BookingProperty', payservedb.BookingProperty.schema, facilityId);
        const BookingReservation = await getModel('BookingReservation', payservedb.BookingReservation.schema, facilityId);
        const BookingInvoice = await getModel('BookingInvoice', payservedb.BookingInvoice.schema, facilityId);
        const Unit = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const Currency = await getModel('Currency', payservedb.Currency.schema, facilityId);

        // Verify property exists and is listed
        const property = await BookingProperty.findById(property_id);
        if (!property) {
            return reply.code(404).send({
                success: false,
                error: 'Property not found',
                message: `No property found with ID: ${property_id}`
            });
        }

        if (!property.isListed) {
            return reply.code(400).send({
                success: false,
                error: 'Property not available',
                message: 'This property is not currently available for booking'
            });
        }

        // Verify unit exists
        const unit = await Unit.findById(unit_id);
        if (!unit) {
            return reply.code(404).send({
                success: false,
                error: 'Unit not found',
                message: `No unit found with ID: ${unit_id}`
            });
        }

        // Normalize dates
        const normalizeDate = (dateStr) => {
            const date = new Date(dateStr);
            return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
        };

        const checkInNormalized = normalizeDate(check_in_date);
        const checkOutNormalized = normalizeDate(check_out_date);

        // Double-check availability before creating reservation
        const conflictingReservations = await BookingReservation.find({
            bookingPropertyId: property_id,
            unitId: unit_id,
            status: { $in: ['reserved', 'booked'] },
            $or: [{
                checkIn: { $lt: checkOutNormalized },
                checkOut: { $gt: checkInNormalized }
            }]
        });

        if (conflictingReservations.length > 0) {
            return reply.code(409).send({
                success: false,
                error: 'Unit not available',
                message: 'This unit is no longer available for the selected dates',
                conflict: true
            });
        }

        // Check for blocked dates
        let blockedDates = [];
        if (property.blockedDates && property.blockedDates.length > 0) {
            blockedDates = property.blockedDates.filter(block => {
                const blockStart = normalizeDate(block.startDate);
                const blockEnd = normalizeDate(block.endDate);
                return blockStart <= checkOutNormalized && blockEnd >= checkInNormalized;
            });
        }

        if (blockedDates.length > 0) {
            return reply.code(409).send({
                success: false,
                error: 'Dates blocked',
                message: 'Some of the selected dates are blocked for booking',
                conflict: true
            });
        }

        // Calculate pricing
        const nights = Math.ceil((checkOutNormalized - checkInNormalized) / (1000 * 60 * 60 * 24));
        const basePrice = property.basePrice || 0;
        const totalAmount = basePrice * nights;

        // Get currency details
        let currency = { _id: null, code: 'USD', name: 'US Dollar' };
        if (property.currencyId) {
            const curr = await Currency.findById(property.currencyId);
            if (curr) {
                currency = {
                    _id: curr._id,
                    code: curr.currencyShortCode,
                    name: curr.currencyName,
                    exchange_rate: curr.exchangeRate
                };
            }
        }

        // Generate unique reservation ID
        const reservationCount = await BookingReservation.countDocuments();
        const reservationId = `RES-${String(reservationCount + 1).padStart(6, '0')}`;

        // Create reservation
        const reservationData = {
            facilityId: facility_id,
            bookingReservationId: reservationId,
            reservationId: reservationId,
            bookingPropertyId: property_id,
            unitId: unit_id,
            checkIn: checkInNormalized,
            checkOut: checkOutNormalized,
            guestInfo: {
                name: guest_info.name,
                email: guest_info.email,
                phone: formattedPhone,
                address: guest_info.address || '',
                idNumber: guest_info.id_number || '',
                identificationNumber: guest_info.id_number || '',
                identificationType: guest_info.id_type || ''
            },
            numberOfGuests: {
                adults: guest_info.adults || 1,
                children: guest_info.children || 0
            },
            specialRequests: special_requests || '',
            status: 'reserved',
            statusHistory: [{
                status: 'reserved',
                timestamp: new Date(),
                notes: 'Created via external API'
            }],
            source: 'external-api',
            metadata: {
                externalApiKey: 'open-api',
                returnUrl: return_url || null
            }
        };

        const newReservation = new BookingReservation(reservationData);
        await newReservation.save();

        console.log(`Reservation created via external API: ${reservationId}`);

        // Generate guest ID (unique identifier for this guest booking)
        const guestId = new mongoose.Types.ObjectId();

        // Generate invoice
        const invoiceCount = await BookingInvoice.countDocuments();
        const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(6, '0')}`;

        // Generate account number for M-Pesa payments: 0 + 5 random digits
        const accountNumber = '0' + Math.floor(10000 + Math.random() * 90000).toString();

        const invoiceData = {
            facilityId: facility_id,
            invoiceId: invoiceNumber,
            invoiceNumber: invoiceNumber,
            accountNumber: accountNumber, // Add account number to invoice
            bookingReservationId: newReservation._id,
            bookingPropertyId: property_id,
            unitId: unit_id,
            guestInfo: {
                name: guest_info.name,
                email: guest_info.email,
                phone: guest_info.phone
            },
            checkIn: checkInNormalized,
            checkOut: checkOutNormalized,
            dueDate: checkInNormalized,
            issueDate: new Date(),
            stayPeriod: {
                checkIn: checkInNormalized,
                checkOut: checkOutNormalized,
                nights: nights
            },
            charges: [{
                description: 'Accommodation',
                quantity: nights,
                unitPrice: basePrice,
                amount: totalAmount
            }],
            basePrice: basePrice,
            totalAmount: totalAmount,
            currencyId: currency._id,
            paymentMethod: 'Mobile Money',
            paymentStatus: 'Pending',
            paymentHistory: [],
            status: 'active',
            source: 'external-api'
        };

        const newInvoice = new BookingInvoice(invoiceData);
        await newInvoice.save();

        console.log(`Invoice generated for reservation ${reservationId}: ${invoiceNumber}`);

        // Create Account entry for M-Pesa payment integration
        try {
            const Account = payservedb.Account;
            const accountExists = await Account.findOne({ accountNumber: accountNumber });

            if (!accountExists) {
                await Account.create({
                    accountNumber: accountNumber,
                    accountType: 'Invoice',
                    facilityId: facility_id,
                    customerId: guestId, // Use generated guest ID
                    amount: totalAmount
                });

                console.log(`Account created for booking invoice: ${accountNumber} (Invoice: ${invoiceNumber})`);
            }
        } catch (accountError) {
            console.error('Failed to create Account entry:', accountError);
            // Don't fail the booking if Account creation fails
        }

        // Register account with mpesa-production service
        try {
            const mpesaApiUrl = process.env.MPESA_API_URL || 'https://sandbox.payments.payserve.co.ke';
            const registerUrl = `${mpesaApiUrl}/v1/addAccount`;

            const registerPayload = {
                accountNumber: accountNumber,
                facilityId: facility_id,
                customerId: guestId.toString()
            };

            const axios = require('axios');
            const mpesaResponse = await axios.post(registerUrl, registerPayload);

            if (mpesaResponse.data && mpesaResponse.data.status === 200) {
                console.log(`Account registered with mpesa-production: ${accountNumber}`);
            } else {
                console.warn(`Failed to register account with mpesa-production:`, mpesaResponse.data);
            }
        } catch (mpesaError) {
            console.error('Failed to register with mpesa-production:', mpesaError.message);
            // Don't fail the booking if mpesa registration fails
        }

        // Send SMS notification
        try {
            const smsMessage = `Dear ${guest_info.name}, your booking at ${property.propertyName} has been reserved (${reservationId}). Check-in: ${check_in_date}. Total: ${currency.code} ${totalAmount}. Complete payment within 24 hours to confirm. Payment link sent to your email.`;

            await sendSms(
                facilityId,
                formattedPhone,
                smsMessage
            );

            console.log(`SMS sent to ${formattedPhone} for booking ${reservationId}`);
        } catch (smsError) {
            console.error('Failed to send SMS notification:', smsError);
            // Don't fail the booking if SMS fails
        }

        // Send email notification
        try {
            const paymentUrl = `${process.env.PAYMENT_REDIRECT_BASE_URL || 'https://core.payserve.co.ke'}/payment?session=`;
            const sessionToken = jwt.sign(
                {
                    booking_reference: reservationId,
                    invoice_id: invoiceNumber,
                    facility_id: facilityId,
                    amount: totalAmount,
                    currency: currency.code,
                    guest_email: guest_info.email,
                    return_url: return_url || null,
                    timestamp: Date.now()
                },
                process.env.SESSION_SECRET || 'your-session-secret-key-change-in-production',
                { expiresIn: '1h' }
            );

            const emailSubject = `Booking Reservation Confirmation - ${reservationId}`;
            const emailBody = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Booking Reservation Confirmed</h2>

                    <p>Dear ${guest_info.name},</p>

                    <p>Thank you for choosing ${property.propertyName}. Your reservation has been created and is pending payment confirmation.</p>

                    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #555;">Booking Details</h3>
                        <p><strong>Booking Reference:</strong> ${reservationId}</p>
                        <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
                        <p><strong>Property:</strong> ${property.propertyName}</p>
                        <p><strong>Unit:</strong> ${unit.name}</p>
                        <p><strong>Check-in:</strong> ${check_in_date}</p>
                        <p><strong>Check-out:</strong> ${check_out_date}</p>
                        <p><strong>Nights:</strong> ${nights}</p>
                        <p><strong>Guests:</strong> ${guest_info.adults || 1} Adult(s), ${guest_info.children || 0} Child(ren)</p>
                        <p><strong>Total Amount:</strong> ${currency.code} ${totalAmount.toFixed(2)}</p>
                        <p><strong>Payment Status:</strong> <span style="color: #ff6600;">Pending</span></p>
                    </div>

                    <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0;"><strong>⚠️ Important:</strong> This booking is reserved but not confirmed. Please complete payment within 24 hours to confirm your booking. Unpaid reservations may be reassigned and cancellation policies will apply.</p>
                    </div>

                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${paymentUrl}${sessionToken}" style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Complete Payment Now</a>
                    </div>

                    <p style="font-size: 12px; color: #666;">Payment link expires in 1 hour. If you have any questions, please contact us.</p>

                    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

                    <p style="font-size: 12px; color: #999;">This is an automated message. Please do not reply to this email.</p>
                </div>
            `;

            // Generate PDF invoice
            const pdfBuffer = await generateBookingInvoicePDF(
                newInvoice,
                newReservation,
                property,
                unit,
                currency
            );

            // Send email with PDF attachment
            await sendBookingEmail(
                facilityId,
                guest_info.email,
                emailSubject,
                emailBody,
                [
                    {
                        filename: `Invoice_${invoiceNumber}.pdf`,
                        content: pdfBuffer,
                        contentType: 'application/pdf'
                    }
                ]
            );

            console.log(`Email with PDF invoice sent to ${guest_info.email} for booking ${reservationId}`);
        } catch (emailError) {
            console.error('Failed to send email notification:', emailError);
            // Don't fail the booking if email fails
        }

        // Generate session token for payment redirect
        const sessionPayload = {
            booking_reference: reservationId,
            invoice_id: invoiceNumber,
            facility_id: facilityId,
            amount: totalAmount,
            currency: currency.code,
            guest_email: guest_info.email,
            return_url: return_url || null,
            timestamp: Date.now()
        };

        // Sign with secret (in production, use environment variable)
        const sessionSecret = process.env.SESSION_SECRET || 'your-session-secret-key-change-in-production';
        const sessionToken = jwt.sign(sessionPayload, sessionSecret, { expiresIn: '1h' });

        // Build payment redirect URL
        const baseUrl = process.env.PAYMENT_REDIRECT_BASE_URL || 'https://your-payserve-domain.com';
        const paymentUrl = `${baseUrl}/payment?session=${sessionToken}`;

        // Build response
        const response = {
            success: true,
            message: 'Booking created successfully',
            data: {
                booking_reference: reservationId,
                invoice_number: invoiceNumber,
                account_number: accountNumber, // M-Pesa account number for payment
                status: 'reserved',
                guest_info: {
                    name: guest_info.name,
                    email: guest_info.email,
                    phone: guest_info.phone
                },
                stay_period: {
                    check_in: check_in_date,
                    check_out: check_out_date,
                    nights: nights
                },
                pricing: {
                    base_price_per_night: basePrice,
                    total_amount: totalAmount,
                    currency: currency.code,
                    currency_details: currency
                },
                payment: {
                    status: 'Pending',
                    payment_url: paymentUrl,
                    session_token: sessionToken,
                    expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour
                }
            },
            warning: 'This booking is reserved but not confirmed. Payment must be completed within the specified time period to confirm the booking. Unpaid reservations may be reassigned and cancellation policies will apply.'
        };

        return reply.code(201).send(response);

    } catch (error) {
        console.error('Error in create_booking (external API):', error);
        return reply.code(500).send({
            success: false,
            error: 'Internal server error',
            message: 'An error occurred while creating the booking',
            debug: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = create_booking;
