const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_booking_property = async (request, reply) => {
    try {
        const { facilityId, propertyId } = request.params;
        
        // Get models with facility context
        const models = {
            bookingProperty: await getModel('BookingProperty', payservedb.BookingProperty.schema, facilityId),
            unit: await getModel('Unit', payservedb.Unit.schema, facilityId),
            currency: await getModel('Currency', payservedb.Currency.schema, facilityId)
        };

        // Get property with populated references
        const property = await models.bookingProperty
            .findById(propertyId)
            .populate({
                path: 'unitId',
                model: models.unit,
                select: 'name unitType division floorUnitNo status homeOwnerId tenantId isListedForBooking'
            })
            .populate({
                path: 'currencyId',
                model: models.currency,
                select: 'currencyName currencyShortCode'
            });

        if (!property) {
            return reply.code(404).send({ 
                success: false,
                error: `Booking property with ID ${propertyId} does not exist.` 
            });
        }

        // Validate that the property still meets eligibility criteria
        let isEligible = true;
        let eligibilityMessage = null;

        // Check if unit exists
        if (!property.unitId) {
            isEligible = false;
            eligibilityMessage = "Unit associated with this booking property no longer exists.";
        } else {
            // Check if unit has a homeowner
            if (!property.unitId.homeOwnerId) {
                isEligible = false;
                eligibilityMessage = "Unit no longer has a home owner assigned.";
            }

            // Check if unit has a tenant
            if (property.unitId.tenantId) {
                isEligible = false;
                eligibilityMessage = "Unit now has an active tenant and can no longer be listed for booking.";
            }

            // Check unit status
            if (property.unitId.status !== 'Active') {
                isEligible = false;
                eligibilityMessage = `Unit is not available for booking. Current status: ${property.unitId.status}`;
            }
        }

        // Include homeowner information in the response
        let homeOwnerInfo = null;
        if (property.unitId && property.unitId.homeOwnerId) {
            const homeOwner = await payservedb.Customer.findById(property.unitId.homeOwnerId);
            if (homeOwner) {
                homeOwnerInfo = {
                    id: homeOwner._id,
                    name: `${homeOwner.firstName} ${homeOwner.lastName}`,
                    customerType: homeOwner.customerType,
                    email: homeOwner.email,
                    phone: homeOwner.phoneNumber
                };
            }
        }

        // Add eligibility and homeowner information to response
        const enhancedProperty = property.toObject();
        enhancedProperty.isEligible = isEligible;
        enhancedProperty.eligibilityMessage = eligibilityMessage;
        enhancedProperty.homeOwnerInfo = homeOwnerInfo;

        return reply.code(200).send({
            success: true,
            data: enhancedProperty
        });

    } catch (error) {
        return reply.code(500).send({ 
            success: false,
            error: error.message || 'An unexpected error occurred while fetching booking property.'
        });
    }
};

module.exports = get_booking_property;