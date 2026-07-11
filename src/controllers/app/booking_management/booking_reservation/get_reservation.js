const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

/**
 * Get single reservation with complete details
 * Includes management type information for conditional frontend display
 */
const get_reservation = async (request, reply) => {
    try {
        const { facilityId, reservationId } = request.params;
        
        // Get models with facility context
        const BookingReservation = await getModel('BookingReservation', payservedb.BookingReservation.schema, facilityId);
        const Unit = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const BookingProperty = await getModel('BookingProperty', payservedb.BookingProperty.schema, facilityId);
        const Currency = await getModel('Currency', payservedb.Currency.schema, facilityId);
        const ValueAddedService = await getModel('ValueAddedService', payservedb.ValueAddedService.schema, facilityId);
        
        // Find reservation by ID or booking reference
        let reservation;
        if (mongoose.Types.ObjectId.isValid(reservationId)) {
            reservation = await BookingReservation.findOne({ 
                _id: reservationId,
                facilityId
            });
        } else {
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

        // Populate all reference fields
        const populatedReservation = await BookingReservation.findById(reservation._id)
            .populate({
                path: 'bookingPropertyId',
                model: BookingProperty,
                select: 'propertyName propertyType basePrice commission managedByLandlord isListed amenities description'
            })
            .populate({
                path: 'unitId',
                model: Unit,
                select: 'name unitType division floorUnitNo homeOwnerId'
            })
            .populate({
                path: 'currencyId',
                model: Currency,
                select: 'currencyName currencyShortCode symbol'
            });

        // Determine management type
        const isLandlordManaged = populatedReservation.bookingPropertyId?.managedByLandlord || false;
        const managementType = isLandlordManaged ? 'landlord' : 'property_manager';

        // Get homeowner details if available
        let homeOwner = null;
        if (populatedReservation.unitId && populatedReservation.unitId.homeOwnerId) {
            try {
                homeOwner = await payservedb.Customer.findById(populatedReservation.unitId.homeOwnerId)
                    .select('firstName lastName email phoneNumber customerType');
            } catch (error) {
                // Continue without homeowner info
            }
        }

        // Calculate booking details
        const checkIn = new Date(populatedReservation.checkIn);
        const checkOut = new Date(populatedReservation.checkOut);
        const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
        
        // Determine reservation timing status
        const now = new Date();
        const isUpcoming = checkIn > now;
        const isActive = checkIn <= now && checkOut >= now;
        const isPast = checkOut < now;

        // Process additional services with details
        let additionalServicesWithDetails = [];
        if (populatedReservation.additionalServices && populatedReservation.additionalServices.length > 0) {
            for (const service of populatedReservation.additionalServices) {
                let serviceWithDetails = { ...service.toObject() };
                
                if (service.serviceId) {
                    try {
                        const serviceDetails = await ValueAddedService.findById(service.serviceId);
                        if (serviceDetails) {
                            serviceWithDetails.details = {
                                description: serviceDetails.description,
                                category: serviceDetails.category
                            };
                        }
                    } catch (error) {
                        // Continue without service details
                    }
                }
                
                additionalServicesWithDetails.push(serviceWithDetails);
            }
        }

        // Process checkout information (if completed)
        let checkoutInfo = null;
        if (populatedReservation.status === 'completed') {
            checkoutInfo = {
                checkoutDate: populatedReservation.checkoutDate,
                checkOutActual: populatedReservation.checkOutActual,
                checkoutNotes: populatedReservation.checkoutNotes || '',
                additionalCheckoutCharges: populatedReservation.additionalCheckoutCharges || []
            };

            // Add financial checkout info only for property manager units
            if (!isLandlordManaged) {
                checkoutInfo.finalAmount = populatedReservation.finalAmount;
                checkoutInfo.revenueProcessed = populatedReservation.revenueProcessed || false;
            }
        }

        // Build the complete reservation response
        const reservationDetails = {
            ...populatedReservation.toObject(),
            
            // Management information
            managementType,
            isLandlordManaged,
            
            // Related data
            homeOwner,
            additionalServices: additionalServicesWithDetails,
            checkoutInfo,
            
            // Calculated fields
            calculatedFields: {
                nights,
                isUpcoming,
                isActive,
                isPast,
                daysUntilCheckIn: isUpcoming ? Math.ceil((checkIn - now) / (1000 * 60 * 60 * 24)) : 0,
                daysUntilCheckOut: isActive ? Math.ceil((checkOut - now) / (1000 * 60 * 60 * 24)) : 0,
                daysSinceCheckout: isPast && populatedReservation.status === 'completed' ? 
                    Math.ceil((now - checkOut) / (1000 * 60 * 60 * 24)) : 0
            },
            
            // Financial summary (only for property manager units)
            financialSummary: isLandlordManaged ? null : {
                basePrice: populatedReservation.basePrice || 0,
                totalAmount: populatedReservation.totalAmount || 0,
                finalAmount: populatedReservation.finalAmount || populatedReservation.totalAmount || 0,
                commission: populatedReservation.commission || 0,
                landlordAmount: populatedReservation.landlordAmount || 0,
                additionalServicesTotal: additionalServicesWithDetails.reduce((sum, service) => 
                    sum + (service.price * service.quantity), 0),
                additionalChargesTotal: checkoutInfo?.additionalCheckoutCharges?.reduce((sum, charge) => 
                    sum + (charge.amount || 0), 0) || 0
            },
            
            // Guest summary
            guestSummary: {
                totalGuests: (populatedReservation.guests?.adults || 0) + (populatedReservation.guests?.children || 0),
                adults: populatedReservation.guests?.adults || 0,
                children: populatedReservation.guests?.children || 0,
                hasSpecialRequests: !!(populatedReservation.specialRequests && populatedReservation.specialRequests.trim())
            }
        };

        return reply.code(200).send({
            success: true,
            data: reservationDetails
        });

    } catch (error) {
        return reply.code(500).send({ 
            success: false,
            error: error.message || 'An unexpected error occurred while fetching reservation details.'
        });
    }
};

module.exports = get_reservation;