const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const { sendSms } = require('../../../../utils/send_new_sms');
const { generateBookingInvoicePDF } = require('../../../external/booking/generateBookingInvoicePDF');
const { sendBookingEmail } = require('../../../external/booking/sendBookingEmail');

const create_reservation = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        const {
            bookingPropertyId,
            unitId,
            guestInfo,
            checkIn,
            checkOut,
            guests,
            basePrice,
            totalAmount,
            commission,
            landlordAmount,
            currencyId,
            paymentMethod,
            paymentTiming,
            invoiceId,
            additionalServices = [],
            specialRequests = '',
            status = 'reserved',
            facilityPaymentDetailsId // For M-Pesa payments
        } = request.body;

        // Validate required fields
        const requiredFields = [
            'bookingPropertyId', 'unitId', 'guestInfo', 'checkIn', 'checkOut'
        ];

        const missingFields = requiredFields.filter(field => !request.body[field]);

        if (missingFields.length > 0) {
            return reply.code(400).send({
                success: false,
                error: `Missing required fields: ${missingFields.join(', ')}`
            });
        }

        // Validate guest info
        const requiredGuestInfoFields = ['name', 'email', 'phone'];
        const missingGuestInfoFields = requiredGuestInfoFields.filter(field => !guestInfo[field]);

        if (missingGuestInfoFields.length > 0) {
            return reply.code(400).send({
                success: false,
                error: `Missing guest info fields: ${missingGuestInfoFields.join(', ')}`
            });
        }

        // Get models with facility context
        const BookingReservation = await getModel('BookingReservation', payservedb.BookingReservation.schema, facilityId);
        const BookingProperty = await getModel('BookingProperty', payservedb.BookingProperty.schema, facilityId);
        const Unit = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const BookingInvoice = await getModel('BookingInvoice', payservedb.BookingInvoice.schema, facilityId);

        // Validate booking property exists
        const bookingProperty = await BookingProperty.findById(bookingPropertyId);
        if (!bookingProperty) {
            return reply.code(404).send({
                success: false,
                error: `Booking property with ID ${bookingPropertyId} does not exist.`
            });
        }

        // Validate unit exists
        const unit = await Unit.findById(unitId);
        if (!unit) {
            return reply.code(404).send({
                success: false,
                error: `Unit with ID ${unitId} does not exist.`
            });
        }

        // Check if property is listed
        if (bookingProperty.isListed === false) {
            return reply.code(400).send({
                success: false,
                error: `This property is not available for booking.`
            });
        }

        // Check management type and validate accordingly
        const isManagedByLandlord = bookingProperty.managedByLandlord;

        if (!isManagedByLandlord) {
            // Property manager managed - validate financial fields
            const requiredFinancialFields = ['basePrice', 'totalAmount', 'currencyId', 'paymentMethod'];
            const missingFinancialFields = requiredFinancialFields.filter(field => !request.body[field]);

            if (missingFinancialFields.length > 0) {
                return reply.code(400).send({
                    success: false,
                    error: `Missing required financial fields for property manager booking: ${missingFinancialFields.join(', ')}`
                });
            }
        }

        // Normalize dates
        const normalizeDate = (dateStr) => {
            const date = new Date(dateStr);
            const year = date.getFullYear();
            const month = date.getMonth();
            const day = date.getDate();
            return new Date(year, month, day, 0, 0, 0, 0);
        };

        const checkInDate = normalizeDate(checkIn);
        const checkOutDate = normalizeDate(checkOut);

        // Check for date conflicts (check for reserved and booked statuses)
        const conflictingReservations = await BookingReservation.find({
            bookingPropertyId: bookingPropertyId,
            unitId: unitId,
            status: { $in: ['reserved', 'booked'] },
            $or: [
                {
                    checkIn: { $lt: checkOutDate },
                    checkOut: { $gt: checkInDate }
                }
            ]
        });

        if (conflictingReservations.length > 0) {
            return reply.code(409).send({
                success: false,
                error: `The selected dates are already booked.`
            });
        }

        // Check for blocked dates
        if (bookingProperty.blockedDates && bookingProperty.blockedDates.length > 0) {
            const hasBlockedDates = bookingProperty.blockedDates.some(block => {
                const blockStart = normalizeDate(block.startDate);
                const blockEnd = normalizeDate(block.endDate);
                return (blockStart <= checkOutDate && blockEnd >= checkInDate);
            });

            if (hasBlockedDates) {
                return reply.code(409).send({
                    success: false,
                    error: `Some of the selected dates are blocked.`
                });
            }
        }

        // Generate a booking reference number
        const bookingReservationId = `BK-${Math.floor(10000 + Math.random() * 30000)}`;

        const normalizeStatus = (value) => {
            if (!value) return null;
            const statusMap = {
                new: 'reserved',
                confirmed: 'booked',
                cancelled: 'canceled',
                canceled: 'canceled',
                reserved: 'reserved',
                booked: 'booked',
                completed: 'completed'
            };
            return statusMap[value] || null;
        };

        const getInitialStatus = () => {
            const normalizedProvided = normalizeStatus(status);
            if (normalizedProvided) {
                return normalizedProvided;
            }

            // If payment is expected after check-in, treat as booked immediately.
            if ((paymentTiming || '').toLowerCase() === 'after') {
                return 'booked';
            }

            return 'reserved';
        };

        const initialStatus = getInitialStatus();

        // Create reservation data
        const reservationData = {
            facilityId,
            bookingPropertyId,
            unitId,
            bookingReservationId,
            guestInfo: {
                name: guestInfo.name,
                email: guestInfo.email,
                phone: guestInfo.phone,
                idNumber: guestInfo.idNumber || ''
            },
            checkIn: checkInDate,
            checkOut: checkOutDate,
            guests: {
                adults: guests?.adults || 1,
                children: guests?.children || 0
            },
            additionalServices: additionalServices || [],
            specialRequests: specialRequests || '',
            status: initialStatus,
            createdAt: new Date()
        };

        // Add financial fields only for property manager managed units
        if (!isManagedByLandlord) {
            reservationData.basePrice = basePrice;
            reservationData.totalAmount = totalAmount;
            reservationData.commission = commission || 0;
            reservationData.landlordAmount = landlordAmount || 0;
            reservationData.currencyId = currencyId;
            reservationData.paymentMethod = paymentMethod;
            reservationData.paymentTiming = paymentTiming || 'After';
        }

        // Add status history entry
        reservationData.statusHistory = [{
            status: initialStatus,
            timestamp: new Date()
        }];

        // Create the reservation
        const newReservation = await BookingReservation.create(reservationData);

        // Create invoice only for property manager managed units
        let generatedInvoiceId = null;
        if (!isManagedByLandlord) {
            // Generate invoice
            const randomDigits = Math.floor(Math.random() * 10000);
            const brInvoiceNumber = `9${randomDigits.toString().padStart(4, '0')}`;

            const currentDate = new Date();
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(currentDate.getDate()).padStart(2, '0');
            const invoiceIdDigits = Math.floor(10000 + Math.random() * 90000);
            generatedInvoiceId = `INV-${year}${month}${day}-${invoiceIdDigits}`;

            const invoiceData = {
                invoiceNumber: brInvoiceNumber,
                facilityId,
                invoiceId: generatedInvoiceId,
                bookingReservationId: newReservation._id,
                unitId: unitId,
                guestInfo: {
                    name: guestInfo.name,
                    email: guestInfo.email,
                    phone: guestInfo.phone,
                    idNumber: guestInfo.idNumber || ''
                },
                issueDate: new Date(),
                dueDate: checkInDate,
                checkIn: checkInDate,
                checkOut: checkOutDate,
                basePrice: basePrice,
                totalAmount: totalAmount,
                additionalServices: additionalServices || [],
                paymentMethod: paymentMethod,
                paymentStatus: paymentTiming === 'Before' ? 'Pending' : 'Pending',
                currencyId: currencyId,
                status: 'active',
                notes: specialRequests || ''
            };

            // Add payment details if Mobile Money and facility payment details provided
            if (paymentMethod === 'Mobile Money' && facilityPaymentDetailsId) {
                const FacilityPaymentDetails = await getModel('FacilityPaymentDetails', payservedb.FacilityPaymentDetails.schema, facilityId);
                const paymentDetails = await FacilityPaymentDetails.findById(facilityPaymentDetailsId);

                if (paymentDetails) {
                    invoiceData.paymentDetails = {
                        paybillNumber: paymentDetails.shortCode,
                        paybillAccountName: `Booking Payment - ${bookingProperty.propertyName || unit.name}`,
                        facilityPaymentDetailsId: facilityPaymentDetailsId
                    };
                }
            }

            await BookingInvoice.create(invoiceData);

            // Update the reservation with the invoice ID
            await BookingReservation.findByIdAndUpdate(
                newReservation._id,
                { invoiceId: generatedInvoiceId }
            );
        }

        // Update property's blocked dates to include this reservation.
        // Use atomic update to avoid validation failure on legacy properties missing required fields.
        const blockedDatesEntry = {
            startDate: checkInDate,
            endDate: checkOutDate,
            reason: 'Reservation',
            notes: `Booking: ${bookingReservationId}`,
            reservationId: newReservation._id
        };

        const propertyUpdates = {
            $push: { blockedDates: blockedDatesEntry }
        };

        if (!bookingProperty.propertyName && unit?.name) {
            propertyUpdates.$set = { propertyName: unit.name };
        }

        await BookingProperty.findByIdAndUpdate(
            bookingProperty._id,
            propertyUpdates,
            { new: true }
        );

        // Prepare response data first (before sending notifications)
        const responseData = newReservation.toObject();

        responseData.unit = {
            id: unit._id,
            name: unit.name,
            unitType: unit.unitType,
            division: unit.division,
            floorUnitNo: unit.floorUnitNo
        };

        if (generatedInvoiceId) {
            responseData.invoiceId = generatedInvoiceId;
        }

        const message = isManagedByLandlord
            ? 'Reservation created successfully'
            : 'Reservation created successfully with invoice. Email and SMS sent to guest.';

        // Send SMS and Email notifications to guest (async - don't wait for completion)
        if (!isManagedByLandlord && generatedInvoiceId) {
            // Fire and forget - send notifications in background
            setImmediate(async () => {
            // Get currency for notifications
            const Currency = await getModel('Currency', payservedb.Currency.schema, facilityId);
            const currency = await Currency.findById(currencyId);

            // Format phone number
            let formattedPhone = guestInfo.phone.replace(/\s+/g, '').replace(/-/g, '').replace(/\(/g, '').replace(/\)/g, '');
            if (!formattedPhone.startsWith('+')) {
                formattedPhone = '+' + formattedPhone;
            }

            // Send SMS notification
            try {
                const smsStatus = initialStatus === 'booked' ? 'booked' : 'reserved';
                const smsMessage = `Dear ${guestInfo.name}, your booking at ${bookingProperty.propertyName} has been ${smsStatus} (${bookingReservationId}). Check-in: ${checkIn}. Total: ${currency?.code || 'KES'} ${totalAmount}. Payment confirmation will be sent to your email.`;

                await sendSms(
                    facilityId,
                    formattedPhone,
                    smsMessage
                );

                console.log(`SMS sent to ${formattedPhone} for booking ${bookingReservationId}`);
            } catch (smsError) {
                console.error('Failed to send SMS notification:', smsError);
                // Don't fail the booking if SMS fails
            }

            // Send email notification with PDF invoice
            try {
                // Get the created invoice
                const invoice = await BookingInvoice.findOne({ invoiceId: generatedInvoiceId });

                if (invoice) {
                    // Generate PDF invoice
                    const pdfBuffer = await generateBookingInvoicePDF(
                        invoice,
                        newReservation,
                        bookingProperty,
                        unit,
                        currency
                    );

                    // Format dates nicely
                    const formatDate = (date) => {
                        const d = new Date(date);
                        return d.toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                        });
                    };

                    const emailSubject = `Booking Reservation Confirmation - ${bookingReservationId}`;
                    const emailBody = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #333;">Booking Reservation Confirmed</h2>

                            <p>Dear ${guestInfo.name},</p>

                            <p>Thank you for your reservation. Your booking has been created successfully.</p>

                            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                                <h3 style="margin-top: 0; color: #555;">Booking Details</h3>
                                <p><strong>Booking Reference:</strong> ${bookingReservationId}</p>
                                <p><strong>Invoice Number:</strong> ${generatedInvoiceId}</p>
                                <p><strong>Property Type:</strong> ${unit.unitType || 'N/A'}</p>
                                <p><strong>Unit:</strong> ${unit.name}${unit.division ? ` (${unit.division})` : ''}</p>
                                <p><strong>Check-in:</strong> ${formatDate(checkIn)}</p>
                                <p><strong>Check-out:</strong> ${formatDate(checkOut)}</p>
                                <p><strong>Guests:</strong> ${guests?.adults || 1} Adult(s), ${guests?.children || 0} Child(ren)</p>
                                <p><strong>Total Amount:</strong> ${currency?.code || 'KES'} ${totalAmount.toFixed(2)}</p>
                                <p><strong>Payment Status:</strong> <span style="color: ${paymentTiming === 'Before' ? '#ff6600' : '#28a745'};">${paymentTiming === 'Before' ? 'Pending' : 'Paid'}</span></p>
                            </div>

                            ${paymentTiming === 'Before' ? `
                            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                                <p style="margin: 0;"><strong>⚠️ Important:</strong> Please complete payment before check-in to confirm your booking.</p>
                            </div>
                            ` : ''}

                            <p>Your invoice is attached to this email.</p>

                            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

                            <p style="font-size: 12px; color: #999;">This is an automated message. If you have any questions, please contact us.</p>
                        </div>
                    `;

                    // Send email with PDF attachment
                    await sendBookingEmail(
                        facilityId,
                        guestInfo.email,
                        emailSubject,
                        emailBody,
                        [{
                            filename: `Invoice-${generatedInvoiceId}.pdf`,
                            content: pdfBuffer,
                            contentType: 'application/pdf'
                        }]
                    );

                    console.log(`Email sent to ${guestInfo.email} for booking ${bookingReservationId}`);
                }
            } catch (emailError) {
                console.error('Failed to send email notification:', emailError);
                // Don't fail the booking if email fails
            }
            }); // End of setImmediate
        }

        // Return response immediately without waiting for notifications
        return reply.code(201).send({
            success: true,
            message: message,
            data: responseData
        });

    } catch (error) {
        return reply.code(500).send({
            success: false,
            error: error.message || 'An unexpected error occurred while creating reservation.'
        });
    }
};

module.exports = create_reservation;
