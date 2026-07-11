const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

/**
 * Update reservation status with proper validation and history tracking
 * Works for both landlord and property manager managed units
 */
const update_reservation_status = async (request, reply) => {
    try {
        const { facilityId, reservationId } = request.params;
        let { status, cancellationDetails } = request.body;

        if (status === 'canceled') {
            status = 'cancelled';
        }

        const normalizeStatus = (value) => {
            if (!value) return null;
            const statusMap = {
                new: 'reserved',
                confirmed: 'booked',
                cancelled: 'cancelled',
                canceled: 'cancelled',
                reserved: 'reserved',
                booked: 'booked',
                completed: 'completed',
                expired: 'expired'
            };
            return statusMap[value] || value;
        };

        // Validate status is provided
        if (!status) {
            return reply.code(400).send({
                success: false,
                error: 'Status is required'
            });
        }

        const normalizedStatus = normalizeStatus(status);

        // Validate status is valid
        const validStatuses = ['reserved', 'booked', 'cancelled', 'completed', 'expired'];
        if (!normalizedStatus || !validStatuses.includes(normalizedStatus)) {
            return reply.code(400).send({
                success: false,
                error: `Invalid status. Status must be one of: ${validStatuses.join(', ')}`
            });
        }

        // Get models with facility context
        const BookingReservation = await getModel('BookingReservation', payservedb.BookingReservation.schema, facilityId);
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

        // Validate status transition
        const currentStatus = normalizeStatus(reservation.status) || reservation.status;
        const validTransitions = {
            reserved: ['booked', 'cancelled'],
            booked: ['completed', 'cancelled'],
            expired: ['cancelled'],
            cancelled: [],
            completed: []
        };

        if (normalizedStatus !== currentStatus &&
            (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(normalizedStatus))) {
            return reply.code(400).send({
                success: false,
                error: `Cannot change status from '${currentStatus}' to '${normalizedStatus}'`
            });
        }

        // If status is cancelled, validate cancellation details
        if (normalizedStatus === 'cancelled') {
            if (!cancellationDetails || !cancellationDetails.reason) {
                return reply.code(400).send({
                    success: false,
                    error: 'Cancellation reason is required when cancelling a reservation'
                });
            }
        }

        // Prepare update data
        const updateData = {
            status: normalizedStatus,
            updatedBy: request.user ? request.user._id : null
        };

        // Add status history entry if status is changing
        if (normalizedStatus !== currentStatus) {
            updateData.statusHistory = [
                ...reservation.statusHistory || [],
                {
                    status: normalizedStatus,
                    timestamp: new Date(),
                    updatedBy: request.user ? request.user._id : null
                }
            ];
        }

        // Add cancellation details if status is cancelled
        if (normalizedStatus === 'cancelled') {
            updateData.cancellationDetails = {
                date: new Date(),
                reason: cancellationDetails.reason,
                refundAmount: cancellationDetails.refundAmount || 0
            };
        }

        // Update the reservation
        let refundPayment = null;

        let bookingInvoice = null;
        if (status === 'cancelled') {
            bookingInvoice = await BookingInvoice.findOne({
                bookingReservationId: reservation._id,
                facilityId
            });

            if (bookingInvoice) {
                await BookingInvoice.findByIdAndUpdate(
                    bookingInvoice._id,
                    {
                        status: 'cancelled',
                        paymentStatus: 'Cancelled'
                    }
                );
            }

            const BookingProperty = await getModel('BookingProperty', payservedb.BookingProperty.schema, facilityId);
            await BookingProperty.updateOne(
                { _id: reservation.bookingPropertyId },
                { $pull: { blockedDates: { reservationId: reservation._id } } }
            );
        }

        if (status === 'cancelled' && (cancellationDetails.refundAmount || 0) > 0) {
            const existingRefund = reservation.cancellationDetails?.refundPaymentId;
            const existingStatus = reservation.cancellationDetails?.refundStatus;
            if (!existingRefund || (existingStatus && ['Rejected'].includes(existingStatus))) {
                let currency = null;
                if (bookingInvoice?.currencyId) {
                    currency = await Currency.findById(bookingInvoice.currencyId);
                }
                if (!currency) {
                    const currencies = await Currency.find({ facilityId }).lean();
                    currency = (currencies || []).find(curr => curr.isDefaultCurrency) || (currencies || [])[0] || null;
                }

                const Facility = payservedb.Facility;
                const facility = await Facility.findById(facilityId);

                const refundAmount = Number(cancellationDetails.refundAmount || 0);
                const refundReceipt = `RFD-${Date.now().toString().slice(-8)}`;
                const paymentReference = `REFUND-${Date.now().toString(36)}`;

                if (facility && currency) {
                    const createdByUserId = request.user?._id || reservation.createdBy || facility._id;
                    refundPayment = await CashPayment.create({
                        paymentReference,
                        receiptNumber: refundReceipt,
                        invoice: {
                            invoiceId: bookingInvoice ? bookingInvoice._id : reservation._id,
                            invoiceNumber: bookingInvoice ? (bookingInvoice.invoiceNumber || bookingInvoice.invoiceId) : reservation.bookingReservationId,
                            accountNumber: bookingInvoice ? bookingInvoice.invoiceId : reservation.bookingReservationId,
                            invoiceType: 'booking-refund'
                        },
                        client: {
                            clientId: new mongoose.Types.ObjectId(),
                            firstName: reservation.guestInfo?.name?.split(' ')[0] || 'Guest',
                            lastName: reservation.guestInfo?.name?.split(' ').slice(1).join(' ') || 'Guest'
                        },
                        facility: {
                            id: facility._id,
                            name: facility.name
                        },
                        paymentAmount: refundAmount,
                        currency: {
                            id: currency._id,
                            name: currency.currencyName,
                            code: currency.currencyShortCode
                        },
                        paymentDate: new Date(),
                        receivedBy: request.user ? new mongoose.Types.ObjectId(request.user._id) : null,
                        paymentMethod: 'cash',
                        approvalStatus: 'Pending',
                        reconciliationStatus: 'Pending',
                        paymentNotes: `Booking refund for ${reservation.bookingReservationId}`,
                        isRefund: true,
                        refundDetails: {
                            reservationId: reservation._id,
                            bookingReservationId: reservation.bookingReservationId,
                            bookingInvoiceId: bookingInvoice ? bookingInvoice._id : null,
                            reason: cancellationDetails.reason
                        },
                        metadata: {
                            createdBy: new mongoose.Types.ObjectId(createdByUserId),
                            source: 'manual',
                            deviceInfo: {
                                deviceId: request.headers['user-agent'] || 'Unknown',
                                ipAddress: request.ip || 'Unknown'
                            }
                        }
                    });

                    updateData.cancellationDetails.refundStatus = 'Pending';
                    updateData.cancellationDetails.refundPaymentId = refundPayment._id;
                    updateData.cancellationDetails.refundReference = paymentReference;
                    updateData.cancellationDetails.refundRequestedAt = new Date();
                } else {
                    updateData.cancellationDetails.refundStatus = 'Pending';
                    updateData.cancellationDetails.refundReference = paymentReference;
                }
            }
        }

        const updatedReservation = await BookingReservation.findByIdAndUpdate(
            reservation._id,
            updateData,
            { new: true }
        );

        // If cancelled, remove reservation blocked dates and update invoice status
        if (normalizedStatus === 'cancelled') {
            const BookingProperty = await getModel('BookingProperty', payservedb.BookingProperty.schema, facilityId);
            await BookingProperty.findByIdAndUpdate(
                reservation.bookingPropertyId,
                {
                    $pull: {
                        blockedDates: {
                            $or: [
                                { reservationId: reservation._id },
                                {
                                    reason: 'Reservation',
                                    startDate: reservation.checkIn,
                                    endDate: reservation.checkOut
                                },
                                { notes: `Booking: ${reservation.bookingReservationId}` }
                            ]
                        }
                    }
                }
            );

            const BookingInvoice = await getModel('BookingInvoice', payservedb.BookingInvoice.schema, facilityId);
            const invoice = await BookingInvoice.findOne({ bookingReservationId: reservation._id });
            if (invoice) {
                const totalPaid = (invoice.paymentHistory || []).reduce((sum, payment) => sum + payment.amount, 0);
                const paymentStatus = totalPaid > 0 || (cancellationDetails?.refundAmount || 0) > 0
                    ? 'Refunded'
                    : 'Cancelled';

                await BookingInvoice.findByIdAndUpdate(
                    invoice._id,
                    {
                        status: 'cancelled',
                        paymentStatus,
                        updatedBy: request.user ? request.user._id : null
                    }
                );
            }
        }

        // Get management type for response
        const BookingProperty = await getModel('BookingProperty', payservedb.BookingProperty.schema, facilityId);
        const bookingProperty = await BookingProperty.findById(reservation.bookingPropertyId);
        const managementType = bookingProperty?.managedByLandlord ? 'landlord' : 'property_manager';

        return reply.code(200).send({
            success: true,
            message: `Reservation status updated from '${currentStatus}' to '${normalizedStatus}'`,
            data: {
                reservationId: updatedReservation._id,
                bookingReservationId: updatedReservation.bookingReservationId,
                previousStatus: currentStatus,
                currentStatus: updatedReservation.status,
                managementType,
                statusHistory: updatedReservation.statusHistory,
                cancellationDetails: updatedReservation.cancellationDetails || null
            }
        });

    } catch (error) {
        return reply.code(500).send({
            success: false,
            error: error.message || 'An unexpected error occurred while updating reservation status.'
        });
    }
};

module.exports = update_reservation_status;
