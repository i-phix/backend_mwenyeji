const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const toggle_property_listing = async (request, reply) => {
    try {
        const { facilityId, propertyId } = request.params;
        const { isListed } = request.body;

        if (isListed === undefined) {
            return reply.code(400).send({
                success: false,
                error: 'isListed property is required.'
            });
        }

        // Get models with facility context
        const models = {
            bookingProperty: await getModel('BookingProperty', payservedb.BookingProperty.schema, facilityId),
            unit: await getModel('Unit', payservedb.Unit.schema, facilityId)
        };

        // Get the booking property
        const property = await models.bookingProperty.findById(propertyId);

        if (!property) {
            return reply.code(404).send({
                success: false,
                error: `Booking property with ID ${propertyId} does not exist.`
            });
        }

        // If trying to list the property, validate it meets all criteria
        if (isListed) {
            // Get the associated unit
            const unit = await models.unit.findById(property.unitId);

            if (!unit) {
                return reply.code(404).send({
                    success: false,
                    error: `Unit associated with this booking property no longer exists.`
                });
            }

            // Check if unit is active
            if (unit.status !== 'Active') {
                return reply.code(400).send({
                    success: false,
                    error: `Unit is not available for booking. Current status: ${unit.status}`
                });
            }

            // Check if unit has a homeowner
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
        }

        // Update the property listing status
        const updatedProperty = await models.bookingProperty.findByIdAndUpdate(
            propertyId,
            { $set: { isListed: Boolean(isListed) } },
            { new: true }
        );

        // Update the unit's isListedForBooking field to match the booking property status
        await models.unit.findByIdAndUpdate(
            property.unitId,
            { $set: { isListedForBooking: Boolean(isListed) } }
        );

        return reply.code(200).send({
            success: true,
            message: isListed ? 'Property is now listed for booking' : 'Property is now unlisted',
            data: updatedProperty
        });

    } catch (error) {
        return reply.code(500).send({
            success: false,
            error: error.message || 'An unexpected error occurred while toggling listing status.'
        });
    }
};

module.exports = toggle_property_listing;