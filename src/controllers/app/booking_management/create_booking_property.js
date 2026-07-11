const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const create_booking_property = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        const {
            unitId,
            managedByLandlord = false,
            propertyName,
            propertyType,
            division,
            description,
            amenities,
            basePrice,
            currencyId,
            weekendPriceAdjustment,
            minimumStay,
            maximumStay,
            advanceBookingDays,
            cancellationPolicy,
            commission,
            blockedDates,
            specialPricing,
            isListed = false,
            status = 'active'
        } = request.body;

        // Validate required fields based on management type
        let requiredFields = ['unitId'];

        if (!managedByLandlord) {
            requiredFields = [...requiredFields, 'basePrice', 'currencyId'];
        }

        const missingFields = requiredFields.filter(field => {
            return !request.body[field];
        });

        if (missingFields.length > 0) {
            return reply.code(400).send({
                success: false,
                error: `Missing required fields: ${missingFields.join(', ')}`
            });
        }

        // Get models with facility context
        const models = {
            bookingProperty: await getModel('BookingProperty', payservedb.BookingProperty.schema, facilityId),
            unit: await getModel('Unit', payservedb.Unit.schema, facilityId),
            currency: await getModel('Currency', payservedb.Currency.schema, facilityId)
        };

        // Validate unit exists
        const unit = await models.unit.findById(unitId);
        if (!unit) {
            return reply.code(404).send({
                success: false,
                error: `Unit with ID ${unitId} does not exist.`
            });
        }

        // Check if unit status is Active 
        if (unit.status !== 'Active') {
            return reply.code(400).send({
                success: false,
                error: `Unit is not available for booking. Current status: ${unit.status}`
            });
        }

        // Check if unit has a home owner assigned
        if (!unit.homeOwnerId) {
            return reply.code(400).send({
                success: false,
                error: `Unit does not have a home owner assigned. A unit must have a home owner to be listed for booking.`
            });
        }

        // Check if unit has a tenant
        if (unit.tenantId) {
            return reply.code(400).send({
                success: false,
                error: `Unit has an active tenant and cannot be listed for booking.`
            });
        }

        // Check if unit is already listed for booking
        if (unit.isListedForBooking) {
            return reply.code(400).send({
                success: false,
                error: `Unit is already listed for booking.`
            });
        }

        // Validate currency exists (only if not managed by landlord)
        let currencyExists = null;
        if (!managedByLandlord && currencyId) {
            try {
                currencyExists = await models.currency.findById(currencyId);

                if (!currencyExists) {
                    currencyExists = await payservedb.Currency.findById(currencyId);
                }
            } catch (err) {
                //console.error('Error finding currency:', err);
            }

            if (!currencyExists) {
                return reply.code(404).send({
                    success: false,
                    error: `Currency with ID ${currencyId} does not exist.`
                });
            }
        }

        // Check if unit is already listed
        const existingListing = await models.bookingProperty.findOne({
            unitId: unitId,
            status: { $nin: ['inactive', 'Inactive'] }
        });

        if (existingListing) {
            return reply.code(409).send({
                success: false,
                error: `Unit is already listed for booking.`
            });
        }

        // Process blocked dates
        const processedBlockedDates = blockedDates ? blockedDates.map(period => ({
            startDate: new Date(period.startDate),
            endDate: new Date(period.endDate),
            reason: period.reason,
            notes: period.notes || ''
        })) : [];

        // Process special pricing
        const processedSpecialPricing = specialPricing ? specialPricing.map(pricing => ({
            startDate: new Date(pricing.startDate),
            endDate: new Date(pricing.endDate),
            price: Number(pricing.price),
            name: pricing.name || 'Special Rate'
        })) : [];

        // Map unit type to valid property type
        // Always use unit type mapping, ignore frontend propertyType value
        const mapUnitTypeToPropertyType = (unitType) => {
            if (!unitType) return 'Apartment';
            const lowerType = unitType.toLowerCase();
            if (lowerType.includes('villa')) return 'Villa';
            if (lowerType.includes('hotel')) return 'Hotel';
            if (lowerType.includes('resort')) return 'Resort';
            if (lowerType.includes('guest')) return 'Guesthouse';
            // Default for studio, one bedroom, two bedroom, etc.
            return 'Apartment';
        };

        // Normalize status value
        const normalizedStatus = status ? status.toLowerCase() : 'active';

        // Auto-pick property type from unit - don't use frontend value
        const autoPropertyType = mapUnitTypeToPropertyType(unit.unitType);

        // Create booking property data
        const bookingPropertyData = {
            facilityId,
            unitId,
            managedByLandlord,
            propertyName: propertyName || unit.name,
            propertyType: autoPropertyType, // Always use mapped value from unit type
            division: division || unit.division,
            description: description || '',
            amenities: amenities || [],
            blockedDates: processedBlockedDates,
            specialPricing: processedSpecialPricing,
            isListed,
            status: normalizedStatus
        };

        // Add property manager specific fields
        if (!managedByLandlord) {
            bookingPropertyData.basePrice = Number(basePrice);
            bookingPropertyData.currencyId = currencyExists._id;
            bookingPropertyData.weekendPriceAdjustment = Number(weekendPriceAdjustment || 0);
            bookingPropertyData.minimumStay = Number(minimumStay || 1);
            bookingPropertyData.maximumStay = Number(maximumStay || 30);
            bookingPropertyData.advanceBookingDays = Number(advanceBookingDays || 0);
            bookingPropertyData.cancellationPolicy = cancellationPolicy || 'Moderate';
            bookingPropertyData.commission = Number(commission || 10);
        }

        // Create booking property
        const bookingProperty = await models.bookingProperty.create(bookingPropertyData);

        // Update unit to mark as listed for booking
        await models.unit.findByIdAndUpdate(unitId, {
            isListedForBooking: true
        });

        // Populate response with unit details
        const populatedBookingProperty = await models.bookingProperty
            .findById(bookingProperty._id)
            .populate({
                path: 'unitId',
                model: models.unit,
                select: 'name unitType division floorUnitNo status'
            })
            .populate({
                path: 'currencyId',
                model: models.currency,
                select: 'currencyName currencyShortCode'
            });

        return reply.code(201).send({
            success: true,
            message: 'Property listed for booking successfully',
            data: populatedBookingProperty
        });

    } catch (error) {
        return reply.code(500).send({
            success: false,
            error: error.message || 'An unexpected error occurred while listing property for booking.'
        });
    }
};

module.exports = create_booking_property;