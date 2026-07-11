const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const update_booking_property = async (request, reply) => {
    try {
        const { facilityId, propertyId } = request.params;
        
        // Get models with facility context
        const models = {
            bookingProperty: await getModel('BookingProperty', payservedb.BookingProperty.schema, facilityId),
            unit: await getModel('Unit', payservedb.Unit.schema, facilityId),
            currency: await getModel('Currency', payservedb.Currency.schema, facilityId)
        };

        // Check if property exists
        const existingProperty = await models.bookingProperty.findById(propertyId);
        if (!existingProperty) {
            return reply.code(404).send({ 
                success: false,
                error: `Booking property with ID ${propertyId} does not exist.` 
            });
        }

        // Check if managedByLandlord is being changed
        const isManagedByLandlord = request.body.managedByLandlord !== undefined 
            ? request.body.managedByLandlord 
            : existingProperty.managedByLandlord;

        // Validate required fields based on management type
        if (!isManagedByLandlord) {
            // For property manager managed units, validate pricing fields if they're being updated
            if (request.body.basePrice !== undefined && !request.body.basePrice) {
                return reply.code(400).send({
                    success: false,
                    error: 'Base price is required for property manager managed units.'
                });
            }
            
            if (request.body.currencyId !== undefined && !request.body.currencyId) {
                return reply.code(400).send({
                    success: false,
                    error: 'Currency is required for property manager managed units.'
                });
            }
        }

        // If updating unit, validate the unit's eligibility
        if (request.body.unitId && request.body.unitId !== existingProperty.unitId.toString()) {
            const newUnit = await models.unit.findById(request.body.unitId);
            
            if (!newUnit) {
                return reply.code(404).send({ 
                    success: false,
                    error: `Unit with ID ${request.body.unitId} does not exist.` 
                });
            }

            // Check if unit status is Active 
            if (newUnit.status !== 'Active') {
                return reply.code(400).send({ 
                    success: false,
                    error: `Unit is not available for booking. Current status: ${newUnit.status}` 
                });
            }

            // Check if unit has a home owner assigned
            if (!newUnit.homeOwnerId) {
                return reply.code(400).send({
                    success: false,
                    error: `Unit does not have a home owner assigned. A unit must have a home owner to be listed for booking.`
                });
            }

            // Check if unit has a tenant
            if (newUnit.tenantId) {
                return reply.code(400).send({
                    success: false,
                    error: `Unit has an active tenant and cannot be listed for booking.`
                });
            }

            // Check if the new unit is already listed for booking
            if (newUnit.isListedForBooking) {
                return reply.code(409).send({
                    success: false,
                    error: `Unit is already listed for booking.`
                });
            }

            // Check if the new unit has another booking property
            const existingListing = await models.bookingProperty.findOne({ 
                unitId: request.body.unitId,
                status: { $ne: 'Inactive' },
                _id: { $ne: propertyId } // Exclude current property
            });

            if (existingListing) {
                return reply.code(409).send({
                    success: false,
                    error: `Unit is already listed for booking.`
                });
            }
        } else {
            // If not changing the unit, verify that the current unit still meets requirements
            const currentUnit = await models.unit.findById(existingProperty.unitId);
            
            if (!currentUnit) {
                return reply.code(404).send({ 
                    success: false,
                    error: `Unit associated with this booking property no longer exists.` 
                });
            }

            // Check if current unit still has active status
            if (currentUnit.status !== 'Active') {
                return reply.code(400).send({ 
                    success: false,
                    error: `Unit is not available for booking. Current status: ${currentUnit.status}` 
                });
            }

            // Check if current unit still has a homeowner
            if (!currentUnit.homeOwnerId) {
                return reply.code(400).send({
                    success: false,
                    error: `Unit no longer has a home owner assigned.`
                });
            }

            // Check if unit now has a tenant
            if (currentUnit.tenantId) {
                return reply.code(400).send({
                    success: false,
                    error: `Unit now has an active tenant and can no longer be listed for booking.`
                });
            }
        }

        // Validate currency if provided (only for property manager managed units)
        if (!isManagedByLandlord && request.body.currencyId) {
            let currencyExists = null;
            try {
                // Try facility-specific currency
                currencyExists = await models.currency.findById(request.body.currencyId);
                
                if (!currencyExists) {
                    // Try global currency
                    currencyExists = await payservedb.Currency.findById(request.body.currencyId);
                }

                if (!currencyExists) {
                    // Try by facilityId
                    currencyExists = await models.currency.findOne({
                        _id: request.body.currencyId,
                        facilityId: facilityId
                    });
                }
            } catch (err) {
                //console.error('Error finding currency:', err);
            }

            if (!currencyExists) {
                return reply.code(404).send({
                    success: false,
                    error: `Currency with ID ${request.body.currencyId} does not exist.`
                });
            }
            
            // Update with the valid currency ID
            request.body.currencyId = currencyExists._id;
        }

        // If switching to landlord managed, clear pricing fields
        if (isManagedByLandlord && !existingProperty.managedByLandlord) {
            request.body.basePrice = null;
            request.body.currencyId = null;
            request.body.weekendPriceAdjustment = null;
            request.body.commission = null;
            request.body.minimumStay = null;
            request.body.maximumStay = null;
            request.body.advanceBookingDays = null;
            request.body.cancellationPolicy = null;
        }

        // Process blocked dates if provided
        if (request.body.blockedDates) {
            request.body.blockedDates = request.body.blockedDates.map(period => ({
                startDate: new Date(period.startDate),
                endDate: new Date(period.endDate),
                reason: period.reason,
                notes: period.notes || ''
            }));
        }

        // Process special pricing if provided (only for property manager managed)
        if (!isManagedByLandlord && request.body.specialPricing) {
            request.body.specialPricing = request.body.specialPricing.map(pricing => ({
                startDate: new Date(pricing.startDate),
                endDate: new Date(pricing.endDate),
                price: Number(pricing.price),
                name: pricing.name || 'Special Rate'
            }));
        } else if (isManagedByLandlord) {
            // Clear special pricing for landlord managed units
            request.body.specialPricing = [];
        }

        // Convert number fields (only for property manager managed units)
        if (!isManagedByLandlord) {
            const numberFields = ['basePrice', 'weekendPriceAdjustment', 'minimumStay', 
                                'maximumStay', 'advanceBookingDays', 'commission'];
            
            numberFields.forEach(field => {
                if (request.body[field] !== undefined) {
                    request.body[field] = Number(request.body[field]);
                }
            });
        }

        // Update property
        const updatedProperty = await models.bookingProperty.findByIdAndUpdate(
            propertyId,
            { $set: request.body },
            { new: true }
        );

        // If unit was changed, update the old unit's isListedForBooking to false
        if (request.body.unitId && request.body.unitId !== existingProperty.unitId.toString()) {
            await models.unit.findByIdAndUpdate(
                existingProperty.unitId,
                { $set: { isListedForBooking: false } }
            );

            // Update the new unit's isListedForBooking to true
            await models.unit.findByIdAndUpdate(
                request.body.unitId,
                { $set: { isListedForBooking: true } }
            );
        }

        // Populate response with unit details
        const populatedProperty = await models.bookingProperty
            .findById(updatedProperty._id)
            .populate({
                path: 'unitId',
                model: models.unit,
                select: 'name unitType division floorUnitNo status isListedForBooking'
            })
            .populate({
                path: 'currencyId',
                model: models.currency,
                select: 'currencyName currencyShortCode'
            });

        const message = isManagedByLandlord 
            ? 'Booking property updated successfully (Landlord Managed)'
            : 'Booking property updated successfully (Property Manager)';

        return reply.code(200).send({
            success: true,
            message: message,
            data: populatedProperty
        });

    } catch (error) {
        return reply.code(500).send({ 
            success: false,
            error: error.message || 'An unexpected error occurred while updating booking property.'
        });
    }
};

module.exports = update_booking_property;