const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const checkout_reservation = async (request, reply) => {
    try {
        const { facilityId, reservationId } = request.params;
        const {
            checkoutNotes,
            finalAmount,
            additionalCharges = [],
            paymentMethod,
            paymentAmount,
            paymentNotes,
            receiptNumber,
            paymentDate,
            checkOutActual,
            transactionId,
            syncOnly
        } = request.body;

        // Get models with facility context
        const BookingReservation = await getModel('BookingReservation', payservedb.BookingReservation.schema, facilityId);
        const BookingProperty = await getModel('BookingProperty', payservedb.BookingProperty.schema, facilityId);
        const Unit = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const RevenueRecord = await getModel('RevenueRecord', payservedb.RevenueRecord.schema, facilityId);
        const BookingInvoice = await getModel('BookingInvoice', payservedb.BookingInvoice.schema, facilityId);
        const CashPayment = await getModel('CashPayment', payservedb.CashPayment.schema, facilityId);
        const Currency = await getModel('Currency', payservedb.Currency.schema, facilityId);

        // Find reservation by ID or booking reference
        let reservation;
        if (mongoose.Types.ObjectId.isValid(reservationId)) {
            reservation = await BookingReservation.findOne({
                _id: reservationId,
                facilityId
            });
        } else {
            // Try to find by booking reference number
            reservation = await BookingReservation.findOne({
                bookingReservationId: reservationId,
                facilityId
            });
        }

        if (!reservation) {
            return reply.code(404).send({
                success: false,
                error: 'Reservation not found'
            });
        }

        // Check if reservation is in a valid state for checkout
        if (!syncOnly && reservation.status !== 'booked') {
            return reply.code(400).send({
                success: false,
                error: `Cannot checkout a reservation with status: ${reservation.status}`
            });
        }

        const invoice = await BookingInvoice.findOne({
            bookingReservationId: reservation._id,
            facilityId
        });

        // Get the booking property to check management type
        const bookingProperty = await BookingProperty.findById(reservation.bookingPropertyId);
        if (!bookingProperty) {
            return reply.code(404).send({
                success: false,
                error: 'Booking property not found'
            });
        }

        const isManagedByLandlord = bookingProperty.managedByLandlord || false;

        // Calculate checkout amount based on management type
        let totalCheckoutAmount = 0;

        if (isManagedByLandlord) {
            // For landlord managed: only process additional charges (no base amount)
            totalCheckoutAmount = 0;
        } else {
            // For property manager: use finalAmount or original totalAmount
            totalCheckoutAmount = finalAmount || reservation.totalAmount || 0;
        }

        const existingCharges = Array.isArray(reservation.additionalCheckoutCharges)
            ? reservation.additionalCheckoutCharges.map((charge) => ({
                ...charge,
                status: charge.status || 'Unpaid',
                paidAmount: Number(charge.paidAmount || 0)
            }))
            : [];

        const chargeKey = (charge) =>
            `${(charge.description || '').trim().toLowerCase()}|${Number(charge.amount || 0)}|${(charge.reason || '').trim().toLowerCase()}`;

        const existingChargeKeys = new Set(existingCharges.map(chargeKey));

        // Process additional charges if any (skip duplicates)
        const processedAdditionalCharges = [...existingCharges];
        if (additionalCharges && additionalCharges.length > 0) {
            for (const charge of additionalCharges) {
                if (!charge.description || !charge.amount) {
                    return reply.code(400).send({
                        success: false,
                        error: 'Each additional charge must have a description and amount'
                    });
                }

                const normalized = {
                    description: charge.description,
                    amount: Number(charge.amount),
                    reason: charge.reason || '',
                    status: charge.status || 'Unpaid',
                    paidAmount: Number(charge.paidAmount || 0),
                    addedAt: charge.addedAt ? new Date(charge.addedAt) : new Date()
                };

                const key = chargeKey(normalized);
                if (existingChargeKeys.has(key)) {
                    continue;
                }

                existingChargeKeys.add(key);
                processedAdditionalCharges.push(normalized);
            }
        }

        const newChargesTotal = processedAdditionalCharges.reduce((sum, charge) => sum + Number(charge.amount || 0), 0);

        const baseInvoiceAmount = reservation.totalAmount || invoice?.totalAmount || 0;
        const updatedInvoiceTotal = baseInvoiceAmount + newChargesTotal;
        totalCheckoutAmount = isManagedByLandlord
            ? newChargesTotal
            : updatedInvoiceTotal || finalAmount || reservation.totalAmount || 0;

        // Sync-only updates (used to keep invoice totals aligned with deductions)
        if (syncOnly && invoice) {
            await BookingInvoice.findByIdAndUpdate(
                invoice._id,
                {
                    totalAmount: updatedInvoiceTotal,
                    updatedBy: request.user ? request.user._id : null
                }
            );

            await BookingReservation.findByIdAndUpdate(
                reservation._id,
                {
                    additionalCheckoutCharges: processedAdditionalCharges
                }
            );

            return reply.code(200).send({
                success: true,
                message: 'Invoice updated successfully',
                data: {
                    reservationId: reservation._id,
                    invoiceId: invoice._id,
                    totalAmount: updatedInvoiceTotal,
                    additionalCharges: processedAdditionalCharges
                }
            });
        }

        const normalizedPaymentMethod = paymentMethod ? paymentMethod.toLowerCase() : '';
        const isCashPayment = normalizedPaymentMethod === 'cash';

        if (reservation.checkoutPending) {
            return reply.code(200).send({
                success: true,
                message: 'Checkout pending finance approval',
                data: {
                    reservationId: reservation._id,
                    bookingReservationId: reservation.bookingReservationId,
                    status: reservation.status,
                    checkoutDate: reservation.checkoutDate,
                    additionalCharges: processedAdditionalCharges,
                    managedByLandlord: isManagedByLandlord,
                    pendingApproval: true
                }
            });
        }

        let totalPaid = 0;
        let balanceRemaining = 0;
        if (invoice) {
            totalPaid = (invoice.paymentHistory || []).reduce((sum, payment) => sum + payment.amount, 0);
            balanceRemaining = updatedInvoiceTotal - totalPaid;
        }

        if (invoice && balanceRemaining > 0) {
            if (!paymentMethod || !paymentAmount || paymentAmount < balanceRemaining) {
                return reply.code(400).send({
                    success: false,
                    error: 'Cannot checkout - invoice is not fully paid',
                    details: {
                        invoiceNumber: invoice.invoiceNumber,
                        paymentStatus: invoice.paymentStatus,
                        totalAmount: updatedInvoiceTotal,
                        totalPaid: totalPaid,
                        balanceRemaining: balanceRemaining
                    }
                });
            }
            if (isCashPayment && !receiptNumber) {
                return reply.code(400).send({
                    success: false,
                    error: 'Receipt number is required for cash payments'
                });
            }
        }

        // Prepare update data based on management type
        const updateData = {
            status: 'completed',
            updatedBy: request.user ? request.user._id : null,
            checkoutNotes: checkoutNotes || '',
            checkoutDate: new Date(),
            checkOutActual: checkOutActual ? new Date(checkOutActual) : new Date(),
            additionalCheckoutCharges: processedAdditionalCharges,
            checkoutPending: false,
            $push: {
                statusHistory: {
                    status: 'completed',
                    timestamp: new Date(),
                    updatedBy: request.user ? request.user._id : null
                }
            }
        };

        // Add finalAmount only for property manager managed units
        if (!isManagedByLandlord) {
            updateData.finalAmount = totalCheckoutAmount;
        }

        // Update the reservation
        let updatedReservation;
        let pendingApproval = false;

        // Handle payments if provided
        if (invoice && balanceRemaining > 0 && paymentMethod && paymentAmount) {
            // Update invoice total before handling payment
            await BookingInvoice.findByIdAndUpdate(invoice._id, { totalAmount: updatedInvoiceTotal });

            if (isCashPayment) {
                const currency = await Currency.findById(invoice.currencyId);
                if (!currency) {
                    return reply.code(404).send({
                        success: false,
                        error: 'Currency not found for this invoice'
                    });
                }

                const Facility = payservedb.Facility;
                const facility = await Facility.findById(facilityId);
                if (!facility) {
                    return reply.code(404).send({
                        success: false,
                        error: 'Facility not found'
                    });
                }

                const guestName = invoice.guestInfo?.name || 'Guest';
                const guestParts = guestName.split(' ').filter(Boolean);
                const guestFirstName = guestParts[0] || 'Guest';
                const guestLastName = guestParts.slice(1).join(' ') || 'Guest';
                const createdByUserId = request.user?._id || facility._id;

                const paymentReference = `BOOKING-${Date.now().toString(36)}`;

                const amountToApply = Math.min(parseFloat(paymentAmount), balanceRemaining);

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
                        clientId: new mongoose.Types.ObjectId(),
                        firstName: guestFirstName,
                        lastName: guestLastName
                    },
                    facility: {
                        id: facility._id,
                        name: facility.name
                    },
                    paymentAmount: amountToApply,
                    currency: {
                        id: currency._id,
                        name: currency.currencyName,
                        code: currency.currencyShortCode
                    },
                    paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
                    receivedBy: request.user ? new mongoose.Types.ObjectId(request.user._id) : null,
                    paymentMethod: 'cash',
                    paymentDetails: {
                        notes: paymentNotes || '',
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
                    paymentNotes: `Checkout payment${paymentNotes ? ': ' + paymentNotes : ''}`
                };

                // Prevent duplicate cash payments for same reservation while pending
                const existingPending = await CashPayment.findOne({
                    'invoice.invoiceId': invoice._id,
                    'facility.id': facilityId,
                    approvalStatus: 'Pending',
                    isVoided: false
                });

                if (existingPending) {
                    const pendingReservation = await BookingReservation.findByIdAndUpdate(
                        reservation._id,
                        {
                            checkoutPending: true,
                            status: reservation.status === 'completed' ? 'booked' : reservation.status,
                            additionalCheckoutCharges: processedAdditionalCharges,
                            updatedBy: request.user ? request.user._id : null
                        },
                        { new: true }
                    );

                    return reply.code(200).send({
                        success: true,
                        message: 'Checkout pending finance approval',
                        data: {
                            reservationId: pendingReservation._id,
                            bookingReservationId: pendingReservation.bookingReservationId,
                            status: pendingReservation.status,
                            checkoutDate: pendingReservation.checkoutDate,
                            additionalCharges: processedAdditionalCharges,
                            managedByLandlord: isManagedByLandlord,
                            pendingApproval: true
                        }
                    });
                }

                await CashPayment.create(cashPaymentData);

                await BookingInvoice.findByIdAndUpdate(
                    invoice._id,
                    {
                        paymentStatus: totalPaid > 0 ? 'Partially Paid' : 'Pending',
                        updatedBy: request.user ? request.user._id : null
                    }
                );

                pendingApproval = true;
                updateData.status = 'booked';
                updateData.checkoutPending = true;
            } else {
                const appliedAmount = parseFloat(paymentAmount);
                const newTotalPaid = totalPaid + appliedAmount;
                const newBalance = updatedInvoiceTotal - newTotalPaid;
                const paymentStatus = newBalance <= 0 ? 'Paid' : 'Partially Paid';

                await BookingInvoice.findByIdAndUpdate(invoice._id, {
                    totalAmount: updatedInvoiceTotal,
                    paymentStatus: paymentStatus,
                    $push: {
                        paymentHistory: {
                            amount: appliedAmount,
                            paymentMethod: paymentMethod,
                            transactionId: transactionId || receiptNumber || '',
                            date: paymentDate ? new Date(paymentDate) : new Date(),
                            notes: paymentNotes || ''
                        }
                    }
                });
            }
        } else if (invoice) {
            await BookingInvoice.findByIdAndUpdate(invoice._id, { totalAmount: updatedInvoiceTotal });
        }

        updatedReservation = await BookingReservation.findByIdAndUpdate(
            reservation._id,
            updateData,
            { new: true }
        );

        // Create revenue record only for property manager managed units
        if (!pendingApproval && !isManagedByLandlord && !reservation.revenueProcessed) {
            try {
                const checkoutDate = new Date();
                const baseAmount = reservation.totalAmount || 0;
                const additionalChargesAmount = processedAdditionalCharges.reduce((sum, charge) => sum + charge.amount, 0);

                // Calculate booking duration
                const checkIn = new Date(reservation.checkIn);
                const checkOut = new Date(reservation.checkOut);
                const bookingDuration = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

                const revenueRecord = {
                    facilityId,
                    reservationId: reservation._id,
                    bookingPropertyId: reservation.bookingPropertyId,
                    unitId: reservation.unitId,
                    checkoutDate: checkoutDate,
                    baseAmount: baseAmount,
                    finalAmount: totalCheckoutAmount,
                    additionalChargesAmount: additionalChargesAmount,
                    currencyId: reservation.currencyId,
                    month: checkoutDate.getMonth() + 1,
                    year: checkoutDate.getFullYear(),
                    quarter: Math.ceil((checkoutDate.getMonth() + 1) / 3),
                    bookingDuration: bookingDuration
                };

                await RevenueRecord.create(revenueRecord);

                // Mark reservation as revenue processed
                await BookingReservation.findByIdAndUpdate(
                    reservation._id,
                    { revenueProcessed: true }
                );

            } catch (revenueError) {
                console.error('Error creating revenue record:', revenueError);
                // Don't fail the checkout if revenue record creation fails
            }
        }

        // Mark the unit as available again
        if (reservation.unitId) {
            await Unit.findByIdAndUpdate(
                reservation.unitId,
                { $set: { lastCleaned: new Date() } },
                { new: true }
            );
        }

        // Prepare response based on management type
        const responseData = {
            reservationId: updatedReservation._id,
            bookingReservationId: updatedReservation.bookingReservationId,
            status: updatedReservation.status,
            checkoutDate: updateData.checkoutDate,
            additionalCharges: processedAdditionalCharges,
            managedByLandlord: isManagedByLandlord,
            pendingApproval
        };

        // Add financial info only for property manager managed units
        if (!isManagedByLandlord) {
            responseData.finalAmount = totalCheckoutAmount;
            responseData.baseAmount = reservation.totalAmount || 0;
        }

        const message = pendingApproval
            ? 'Checkout pending finance approval'
            : (isManagedByLandlord ? 'Guest checked out successfully (Landlord Managed)' : 'Guest checked out successfully');

        return reply.code(200).send({
            success: true,
            message: message,
            data: responseData
        });

    } catch (error) {
        return reply.code(500).send({
            success: false,
            error: error.message || 'An unexpected error occurred during checkout'
        });
    }
};

module.exports = checkout_reservation;
