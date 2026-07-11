const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_all_units_and_booking_properties = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        
        // Get models with facility context
        const models = {
            bookingProperty: await getModel('BookingProperty', payservedb.BookingProperty.schema, facilityId),
            unit: await getModel('Unit', payservedb.Unit.schema, facilityId),
            currency: await getModel('Currency', payservedb.Currency.schema, facilityId)
        };

        // Get all eligible units (both listed and not listed)
        const allEligibleUnits = await models.unit.find({
            facilityId,
            status: 'Active',
            homeOwnerId: { $exists: true, $ne: null },
            $or: [
                { tenantId: { $exists: false } },
                { tenantId: null }
            ]
        });

        // Get all booking properties for these units
        const unitIds = allEligibleUnits.map(unit => unit._id);
        const bookingProperties = await models.bookingProperty
            .find({
                facilityId,
                unitId: { $in: unitIds }
            })
            .populate({
                path: 'currencyId',
                model: models.currency,
                select: 'currencyName currencyShortCode'
            });

        // Create a map of unitId to booking property
        const bookingPropertyMap = {};
        bookingProperties.forEach(property => {
            const unitId = property.unitId.toString();
            bookingPropertyMap[unitId] = property;
        });

        // Combine units with their booking properties
        const result = allEligibleUnits.map(unit => {
            const unitId = unit._id.toString();
            const bookingProperty = bookingPropertyMap[unitId] || null;
            
            return {
                unit: {
                    id: unit._id,
                    name: unit.name,
                    unitType: unit.unitType,
                    division: unit.division,
                    floorUnitNo: unit.floorUnitNo,
                    status: unit.status,
                    homeOwnerId: unit.homeOwnerId,
                    isListedForBooking: unit.isListedForBooking || false
                },
                bookingProperty: bookingProperty ? {
                    id: bookingProperty._id,
                    propertyName: bookingProperty.propertyName,
                    propertyType: bookingProperty.propertyType,
                    basePrice: bookingProperty.basePrice,
                    currencyId: bookingProperty.currencyId?._id || bookingProperty.currencyId,
                    currency: bookingProperty.currencyId ? {
                        _id: bookingProperty.currencyId._id,
                        name: bookingProperty.currencyId.currencyName,
                        code: bookingProperty.currencyId.currencyShortCode
                    } : null,
                    isListed: bookingProperty.isListed,
                    status: bookingProperty.status,
                    managedByLandlord: bookingProperty.managedByLandlord,
                    commission: bookingProperty.commission,
                    minimumStay: bookingProperty.minimumStay,
                    maximumStay: bookingProperty.maximumStay,
                    cancellationPolicy: bookingProperty.cancellationPolicy,
                    weekendPriceAdjustment: bookingProperty.weekendPriceAdjustment,
                    advanceBookingDays: bookingProperty.advanceBookingDays,
                    amenities: bookingProperty.amenities,
                    description: bookingProperty.description
                } : null
            };
        });

        return reply.code(200).send({
            success: true,
            data: result
        });

    } catch (error) {
        return reply.code(500).send({ 
            success: false,
            error: error.message || 'An unexpected error occurred while fetching units and booking properties.'
        });
    }
};

module.exports = get_all_units_and_booking_properties;