const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_booking_blocked_dates = async (request, reply) => {
    try {
        const { facilityId, propertyId } = request.params;
        
        //console.log(`API request for blocked dates - Facility: ${facilityId}, Property: ${propertyId}`);
        
        // Validate required params
        if (!facilityId || !propertyId) {
            //console.log('Missing required parameters');
            return reply.code(400).send({ 
                success: false,
                error: 'Facility ID and Property ID are required.' 
            });
        }

        // Get models with facility context
        const models = {
            bookingProperty: await getModel('BookingProperty', payservedb.BookingProperty.schema, facilityId),
            bookingReservation: await getModel('BookingReservation', payservedb.BookingReservation.schema, facilityId)
        };

        // Check if property exists - use proper error handling for MongoDB/Mongoose
        let property;
        try {
            property = await models.bookingProperty.findById(propertyId);
            //console.log(`Property lookup result: ${property ? 'Found' : 'Not found'}`);
        } catch (err) {
            //console.error(`Error finding property: ${err.message}`);
            
            // Check if this is an invalid ObjectId error
            if (err.name === 'CastError' && err.kind === 'ObjectId') {
                return reply.code(400).send({
                    success: false,
                    error: `Invalid property ID format: ${propertyId}`
                });
            }
            
            throw err; // Let the outer catch handle other errors
        }
        
        if (!property) {
            return reply.code(404).send({ 
                success: false,
                error: `Booking property with ID ${propertyId} does not exist.` 
            });
        }

        // Get all blocked dates for this property
        const blockedDates = property.blockedDates || [];
        //console.log(`Found ${blockedDates.length} blocked dates for property ${propertyId}`);

        // Get all active reservations for this property - be more flexible with the query
        //console.log(`Searching for reservations with bookingPropertyId: ${propertyId}`);
        
        const reservations = await models.bookingReservation.find({
            bookingPropertyId: propertyId,
            status: { $in: ['reserved', 'booked'] }, // Only active reservations
        });
        
        //console.log(`Found ${reservations.length} active reservations for property ${propertyId}`);
        
        // Format the blocked dates properly
        const formattedBlockedDates = blockedDates.map(block => ({
            id: block._id ? block._id.toString() : `block-${Date.now()}-${Math.random()}`,
            startDate: block.startDate,
            endDate: block.endDate,
            reason: block.reason || 'Blocked',
            notes: block.notes || '',
            type: 'blocked'
        }));
        
        // Format the reservations as unavailable dates
        const reservationBlockedDates = reservations.map(reservation => ({
            id: reservation._id ? reservation._id.toString() : `res-${Date.now()}-${Math.random()}`,
            startDate: reservation.checkIn,
            endDate: reservation.checkOut,
            reason: 'Reserved',
            notes: 'This unit is already booked',
            type: 'reservation',
            reservation: {
                id: reservation._id ? reservation._id.toString() : null,
                guestName: reservation.guestInfo?.name || 'Guest',
                bookingId: reservation.bookingReservationId || (reservation._id ? reservation._id.toString() : null)
            }
        }));
        
        // Combine both types of unavailable dates
        const allUnavailableDates = [...formattedBlockedDates, ...reservationBlockedDates];
        
        //console.log(`Returning a total of ${allUnavailableDates.length} unavailable dates for property ${propertyId}`);
        
        return reply.code(200).send({
            success: true,
            message: 'Retrieved blocked and booked dates successfully',
            data: {
                blockedDates: formattedBlockedDates,
                reservationDates: reservationBlockedDates,
                allUnavailableDates: allUnavailableDates
            }
        });

    } catch (error) {
        //console.error('Error in get_booking_blocked_dates:', error);
        
        return reply.code(500).send({ 
            success: false,
            error: error.message || 'An unexpected error occurred while fetching unavailable dates.'
        });
    }
};

module.exports = get_booking_blocked_dates;