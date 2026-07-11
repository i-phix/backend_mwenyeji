const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

/**
 * Check available dates for a booking property
 * Returns calendar data showing available, blocked, and booked dates
 */
const check_available_dates = async (request, reply) => {
    try {
        const { facilityId, propertyId } = request.params;
        const { month, year } = request.query;

        // Validate required fields
        if (!month || !year) {
            return reply.code(400).send({
                success: false,
                error: 'Month and year are required.'
            });
        }

        // Parse and validate month and year
        const monthInt = parseInt(month, 10) - 1; // Convert to 0-based month
        const yearInt = parseInt(year, 10);

        if (isNaN(monthInt) || monthInt < 0 || monthInt > 11) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid month. Must be between 1 and 12.'
            });
        }

        if (isNaN(yearInt) || yearInt < 2020 || yearInt > 2030) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid year. Must be between 2020 and 2030.'
            });
        }

        // Get models with facility context
        const BookingProperty = await getModel('BookingProperty', payservedb.BookingProperty.schema, facilityId);
        const BookingReservation = await getModel('BookingReservation', payservedb.BookingReservation.schema, facilityId);
        const Unit = await getModel('Unit', payservedb.Unit.schema, facilityId);

        // Get the booking property
        const property = await BookingProperty.findById(propertyId);
        if (!property) {
            return reply.code(404).send({
                success: false,
                error: `Booking property with ID ${propertyId} does not exist.`
            });
        }

        // Get the associated unit for display purposes
        const unit = await Unit.findById(property.unitId);

        // Calculate month boundaries
        const startDate = new Date(yearInt, monthInt, 1);
        const endDate = new Date(yearInt, monthInt + 1, 0); // Last day of month

        // Get all active reservations for this property in the month
        const reservations = await BookingReservation.find({
            facilityId,
            bookingPropertyId: propertyId,
            status: { $in: ['reserved', 'booked'] }, // Only active reservations affect availability
            $or: [
                // Reservations that start within the month
                {
                    checkIn: { $gte: startDate, $lte: endDate }
                },
                // Reservations that end within the month
                {
                    checkOut: { $gte: startDate, $lte: endDate }
                },
                // Reservations that span the entire month
                {
                    $and: [
                        { checkIn: { $lte: startDate } },
                        { checkOut: { $gte: endDate } }
                    ]
                }
            ]
        }).populate({
            path: 'unitId',
            model: Unit,
            select: 'name'
        });

        // Get blocked dates for this property
        const blockedDates = property.blockedDates || [];

        // Generate calendar data for the month
        const calendarData = generateCalendarData(yearInt, monthInt, reservations, blockedDates);

        // Format reservations for response
        const formattedReservations = reservations.map(reservation => ({
            id: reservation._id,
            bookingReservationId: reservation.bookingReservationId,
            guestName: reservation.guestInfo?.name || 'Guest',
            checkIn: reservation.checkIn.toISOString(),
            checkOut: reservation.checkOut.toISOString(),
            status: reservation.status,
            nights: Math.ceil((new Date(reservation.checkOut) - new Date(reservation.checkIn)) / (1000 * 60 * 60 * 24))
        }));

        // Format blocked periods for response
        const formattedBlockedPeriods = blockedDates
            .filter(block => {
                const blockStart = new Date(block.startDate);
                const blockEnd = new Date(block.endDate);
                // Include blocks that overlap with the requested month
                return blockStart <= endDate && blockEnd >= startDate;
            })
            .map(block => ({
                startDate: new Date(block.startDate).toISOString(),
                endDate: new Date(block.endDate).toISOString(),
                reason: block.reason,
                notes: block.notes || ''
            }));

        return reply.code(200).send({
            success: true,
            data: {
                propertyId: property._id,
                propertyName: property.propertyName,
                unitName: unit?.name || 'Unknown Unit',
                managedByLandlord: property.managedByLandlord || false,
                month: monthInt + 1, // Convert back to 1-based
                year: yearInt,
                calendar: calendarData,
                reservations: formattedReservations,
                blockedPeriods: formattedBlockedPeriods,
                summary: {
                    totalDaysInMonth: calendarData.length,
                    availableDays: calendarData.filter(day => day.status === 'available').length,
                    bookedDays: calendarData.filter(day => day.status === 'booked').length,
                    blockedDays: calendarData.filter(day => day.status === 'blocked').length,
                    totalReservations: formattedReservations.length,
                    totalBlockedPeriods: formattedBlockedPeriods.length
                }
            }
        });

    } catch (error) {
        return reply.code(500).send({
            success: false,
            error: error.message || 'An unexpected error occurred while checking available dates.'
        });
    }
};

/**
 * Generate calendar data for a specific month
 */
function generateCalendarData(year, month, reservations, blockedDates) {
    const calendarData = [];
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month, day);
        const dateString = currentDate.toISOString().split('T')[0];

        // Check if this date is booked
        const isBooked = reservations.some(reservation => {
            const checkIn = new Date(reservation.checkIn);
            const checkOut = new Date(reservation.checkOut);

            // Normalize dates to compare only date parts
            const checkInDate = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());
            const checkOutDate = new Date(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate());

            // Check if current date falls within the reservation period
            return currentDate >= checkInDate && currentDate < checkOutDate;
        });

        // Check if this date is blocked
        const isBlocked = blockedDates.some(block => {
            const blockStart = new Date(block.startDate);
            const blockEnd = new Date(block.endDate);

            // Normalize dates to compare only date parts
            const blockStartDate = new Date(blockStart.getFullYear(), blockStart.getMonth(), blockStart.getDate());
            const blockEndDate = new Date(blockEnd.getFullYear(), blockEnd.getMonth(), blockEnd.getDate());

            // Check if current date falls within the blocked period
            return currentDate >= blockStartDate && currentDate <= blockEndDate;
        });

        // Determine status (priority: blocked > booked > available)
        let status = 'available';
        let details = null;

        if (isBlocked) {
            status = 'blocked';
            const blockingPeriod = blockedDates.find(block => {
                const blockStart = new Date(block.startDate);
                const blockEnd = new Date(block.endDate);
                const blockStartDate = new Date(blockStart.getFullYear(), blockStart.getMonth(), blockStart.getDate());
                const blockEndDate = new Date(blockEnd.getFullYear(), blockEnd.getMonth(), blockEnd.getDate());
                return currentDate >= blockStartDate && currentDate <= blockEndDate;
            });

            if (blockingPeriod) {
                details = {
                    reason: blockingPeriod.reason,
                    notes: blockingPeriod.notes || '',
                    blockStart: blockingPeriod.startDate,
                    blockEnd: blockingPeriod.endDate
                };
            }
        } else if (isBooked) {
            status = 'booked';
            const bookingReservation = reservations.find(reservation => {
                const checkIn = new Date(reservation.checkIn);
                const checkOut = new Date(reservation.checkOut);
                const checkInDate = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());
                const checkOutDate = new Date(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate());
                return currentDate >= checkInDate && currentDate < checkOutDate;
            });

            if (bookingReservation) {
                details = {
                    reservationId: bookingReservation._id,
                    bookingReservationId: bookingReservation.bookingReservationId,
                    guestName: bookingReservation.guestInfo?.name || 'Guest',
                    checkIn: bookingReservation.checkIn,
                    checkOut: bookingReservation.checkOut,
                    status: bookingReservation.status
                };
            }
        }

        // Determine if it's past, today, or future
        const today = new Date();
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        let timeStatus = 'future';
        if (currentDate < todayDate) {
            timeStatus = 'past';
        } else if (currentDate.getTime() === todayDate.getTime()) {
            timeStatus = 'today';
        }

        calendarData.push({
            date: currentDate.toISOString(),
            day: day,
            dayOfWeek: currentDate.getDay(), // 0 = Sunday, 1 = Monday, etc.
            status, // 'available', 'booked', 'blocked'
            timeStatus, // 'past', 'today', 'future'
            details,
            isWeekend: currentDate.getDay() === 0 || currentDate.getDay() === 6,
            isBookable: status === 'available' && timeStatus !== 'past'
        });
    }

    return calendarData;
}

module.exports = check_available_dates;