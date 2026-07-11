const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const calculate_booking_price = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { 
            bookingPropertyId, 
            checkIn, 
            checkOut,
            additionalServices = []
        } = request.body;

        // Validate required fields
        if (!bookingPropertyId || !checkIn || !checkOut) {
            return reply.code(400).send({
                success: false,
                error: 'Booking property ID, check-in date, and check-out date are required.'
            });
        }

        // Get models with facility context
        const models = {
            bookingProperty: await getModel('BookingProperty', payservedb.BookingProperty.schema, facilityId),
            bookingConfig: await getModel('BookingConfig', payservedb.BookingConfig.schema, facilityId),
            valueAddedService: await getModel('ValueAddedService', payservedb.ValueAddedService.schema, facilityId)
        };

        // Get booking property
        const bookingProperty = await models.bookingProperty.findById(bookingPropertyId);
        if (!bookingProperty) {
            return reply.code(404).send({
                success: false,
                error: `Booking property with ID ${bookingPropertyId} does not exist.`
            });
        }

        // Parse dates
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        
        if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
            return reply.code(400).send({
                success: false,
                error: `Invalid check-in or check-out date.`
            });
        }

        // Calculate number of nights
        const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
        
        if (nights <= 0) {
            return reply.code(400).send({
                success: false,
                error: `Check-out date must be after check-in date.`
            });
        }

        // Check minimum/maximum stay
        if (nights < bookingProperty.minimumStay) {
            return reply.code(400).send({
                success: false,
                error: `Minimum stay for this property is ${bookingProperty.minimumStay} nights.`
            });
        }
        
        if (nights > bookingProperty.maximumStay) {
            return reply.code(400).send({
                success: false,
                error: `Maximum stay for this property is ${bookingProperty.maximumStay} nights.`
            });
        }

        // Calculate base price (considering special pricing if applicable)
        let basePrice = bookingProperty.basePrice;
        
        // Check for special pricing periods
        for (const specialPricing of bookingProperty.specialPricing) {
            const specialStartDate = new Date(specialPricing.startDate);
            const specialEndDate = new Date(specialPricing.endDate);
            
            if (checkInDate <= specialEndDate && checkOutDate >= specialStartDate) {
                basePrice = specialPricing.price;
                break; // Use the first applicable special pricing
            }
        }

        // Calculate additional services cost
        let additionalServicesCost = 0;
        let processedServices = [];
        
        if (additionalServices && additionalServices.length > 0) {
            for (const service of additionalServices) {
                if (service.serviceId) {
                    // Look up service if ID is provided
                    const serviceData = await models.valueAddedService.findById(service.serviceId);
                    if (serviceData) {
                        const serviceCost = service.price * (service.quantity || 1);
                        additionalServicesCost += serviceCost;
                        
                        processedServices.push({
                            serviceId: serviceData._id,
                            serviceName: serviceData.serviceName,
                            quantity: service.quantity || 1,
                            price: service.price,
                            total: serviceCost
                        });
                    }
                } else if (service.serviceName && service.price) {
                    // Custom service
                    const serviceCost = service.price * (service.quantity || 1);
                    additionalServicesCost += serviceCost;
                    
                    processedServices.push({
                        serviceName: service.serviceName,
                        quantity: service.quantity || 1,
                        price: service.price,
                        total: serviceCost
                    });
                }
            }
        }

        // Get commission rate
        let commissionRate = bookingProperty.commission;
        
        // Calculate totals
        const subTotal = basePrice * nights;
        const totalAmount = subTotal + additionalServicesCost;
        const commission = (totalAmount * commissionRate) / 100;
        const landlordAmount = totalAmount - commission;

        // Prepare response
        const priceDetails = {
            nights,
            basePrice,
            subTotal,
            additionalServices: processedServices,
            additionalServicesCost,
            totalAmount,
            commissionRate,
            commission,
            landlordAmount,
            currency: bookingProperty.currencyId
        };

        return reply.code(200).send({
            success: true,
            data: priceDetails
        });

    } catch (error) {
        //console.error('Error in calculate_booking_price:', error);
        
        return reply.code(500).send({ 
            success: false,
            error: error.message || 'An unexpected error occurred while calculating booking price.'
        });
    }
};

module.exports = calculate_booking_price;