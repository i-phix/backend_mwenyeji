const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

/**
 * Record checkout revenue - ONLY for Property Manager managed units
 * Landlord managed units are completely skipped from revenue recording
 */
const record_checkout_for_revenue = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            checkoutDate,
            reservationId,
            additionalCharges = []
        } = request.body;

        // Get models with facility context
        const BookingReservation = await getModel('BookingReservation', payservedb.BookingReservation.schema, facilityId);
        const BookingProperty = await getModel('BookingProperty', payservedb.BookingProperty.schema, facilityId);
        const RevenueRecord = await getModel('RevenueRecord', payservedb.RevenueRecord.schema, facilityId);

        // Find the reservation
        const reservation = await BookingReservation.findById(reservationId);
        if (!reservation) {
            return reply.code(404).send({
                success: false,
                error: 'Reservation not found'
            });
        }

        // Get the booking property to check management type
        const bookingProperty = await BookingProperty.findById(reservation.bookingPropertyId);
        if (!bookingProperty) {
            return reply.code(404).send({
                success: false,
                error: 'Booking property not found'
            });
        }

        // SKIP revenue recording for landlord managed units
        if (bookingProperty.managedByLandlord) {
            return reply.code(200).send({
                success: true,
                message: 'Revenue recording skipped - landlord managed unit',
                data: {
                    reservationId: reservation._id,
                    status: 'skipped',
                    managementType: 'landlord',
                    reason: 'Landlord managed units do not participate in revenue tracking'
                }
            });
        }

        // Don't process if already recorded (prevent duplicates)
        if (reservation.revenueProcessed) {
            return reply.code(200).send({
                success: true,
                message: 'Revenue already recorded for this property manager unit',
                data: {
                    reservationId: reservation._id,
                    status: 'already_processed',
                    managementType: 'property_manager'
                }
            });
        }

        // Process revenue recording for property manager unit
        const checkoutDateObj = new Date(checkoutDate || reservation.checkoutDate || new Date());
        const month = checkoutDateObj.getMonth() + 1; // 1-12
        const year = checkoutDateObj.getFullYear();
        const quarter = Math.floor((month - 1) / 3) + 1; // 1-4

        // Calculate booking duration
        const checkIn = new Date(reservation.checkIn);
        const checkOut = new Date(reservation.checkOut);
        const bookingDuration = Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24));

        // Calculate additional charges total
        const additionalChargesTotal = additionalCharges.reduce(
            (sum, charge) => sum + (Number(charge.amount) || 0), 0
        );

        // Create revenue record
        const revenueRecord = new RevenueRecord({
            facilityId: reservation.facilityId,
            reservationId: reservation._id,
            bookingPropertyId: reservation.bookingPropertyId,
            unitId: reservation.unitId,
            checkoutDate: checkoutDateObj,
            baseAmount: reservation.basePrice || 0,
            finalAmount: (reservation.finalAmount || reservation.totalAmount || 0) + additionalChargesTotal,
            additionalChargesAmount: additionalChargesTotal,
            currencyId: reservation.currencyId,
            month,
            year,
            quarter,
            bookingDuration
        });

        await revenueRecord.save();

        // Mark reservation as revenue processed
        await BookingReservation.findByIdAndUpdate(
            reservation._id,
            { $set: { revenueProcessed: true } }
        );

        return reply.code(201).send({
            success: true,
            message: 'Revenue recorded successfully for property manager unit',
            data: {
                reservationId: reservation._id,
                recordId: revenueRecord._id,
                finalAmount: revenueRecord.finalAmount,
                baseAmount: revenueRecord.baseAmount,
                additionalChargesAmount: additionalChargesTotal,
                managementType: 'property_manager',
                period: {
                    month: month,
                    quarter: quarter,
                    year: year
                }
            }
        });

    } catch (error) {
        return reply.code(500).send({
            success: false,
            error: error.message || 'An unexpected error occurred while recording revenue'
        });
    }
};

module.exports = record_checkout_for_revenue;