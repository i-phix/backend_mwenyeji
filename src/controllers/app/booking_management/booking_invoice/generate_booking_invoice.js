const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

/**
 * Generate booking invoice - ONLY for Property Manager managed units
 * Landlord managed units handle their own invoicing
 */
const generate_booking_invoice = async (request, reply) => {
    try {
        const { facilityId, reservationId } = request.params;

        // Get models with facility context
        const models = {
            bookingReservation: await getModel('BookingReservation', payservedb.BookingReservation.schema, facilityId),
            bookingProperty: await getModel('BookingProperty', payservedb.BookingProperty.schema, facilityId),
            unit: await getModel('Unit', payservedb.Unit.schema, facilityId),
            currency: await getModel('Currency', payservedb.Currency.schema, facilityId),
            customer: await getModel('Customer', payservedb.Customer.schema, facilityId)
        };

        // Get reservation
        const reservation = await models.bookingReservation.findById(reservationId);
        if (!reservation) {
            return reply.code(404).send({
                success: false,
                error: `Booking reservation with ID ${reservationId} does not exist.`
            });
        }

        // Get booking property to check management type
        const bookingProperty = await models.bookingProperty.findById(reservation.bookingPropertyId);
        if (!bookingProperty) {
            return reply.code(404).send({
                success: false,
                error: `Booking property not found for this reservation.`
            });
        }

        // ONLY generate invoices for property manager managed units
        if (bookingProperty.managedByLandlord) {
            return reply.code(400).send({
                success: false,
                error: 'Invoice generation is not available for landlord managed units',
                data: {
                    reservationId: reservation._id,
                    managementType: 'landlord',
                    reason: 'Landlord managed units handle their own invoicing'
                }
            });
        }

        // Get unit information
        const unit = await models.unit.findById(reservation.unitId);
        if (!unit) {
            return reply.code(404).send({
                success: false,
                error: `Unit not found for this reservation.`
            });
        }

        // Get landlord information if available
        let landlord = null;
        if (unit.homeOwnerId) {
            landlord = await models.customer.findById(unit.homeOwnerId);
        }

        // Get currency information
        const currency = await models.currency.findById(reservation.currencyId);

        // Calculate booking duration
        const checkIn = new Date(reservation.checkIn);
        const checkOut = new Date(reservation.checkOut);
        const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

        // Generate invoice data structure for property manager unit
        const invoiceData = {
            facilityId: facilityId,
            invoiceType: 'PropertyManagerBooking',
            invoiceNumber: `PM-BK-${reservation.bookingReservationId}`,

            // Customer (Guest) Details
            customerDetails: {
                name: reservation.guestInfo.name,
                email: reservation.guestInfo.email,
                phone: reservation.guestInfo.phone,
                idNumber: reservation.guestInfo.idNumber || ''
            },

            // Landlord Details
            landlordDetails: landlord ? {
                id: landlord._id,
                name: `${landlord.firstName || ''} ${landlord.lastName || ''}`.trim(),
                email: landlord.email || '',
                phone: landlord.phoneNumber || '',
                customerNumber: landlord.customerNumber
            } : null,

            // Property Details
            propertyDetails: {
                unitName: unit.name,
                unitType: unit.unitType,
                division: unit.division,
                floorUnitNo: unit.floorUnitNo,
                propertyName: bookingProperty.propertyName,
                propertyType: bookingProperty.propertyType
            },

            // Booking Details
            bookingDetails: {
                id: reservation._id,
                bookingId: reservation.bookingReservationId,
                checkIn: reservation.checkIn,
                checkOut: reservation.checkOut,
                nights: nights,
                guests: {
                    adults: reservation.guests?.adults || 0,
                    children: reservation.guests?.children || 0,
                    total: (reservation.guests?.adults || 0) + (reservation.guests?.children || 0)
                },
                specialRequests: reservation.specialRequests || ''
            },

            // Financial Breakdown
            financialDetails: {
                basePrice: reservation.basePrice || 0,
                nights: nights,
                subtotal: (reservation.basePrice || 0) * nights,
                totalAmount: reservation.totalAmount || 0,
                finalAmount: reservation.finalAmount || reservation.totalAmount || 0,
                commission: reservation.commission || 0,
                commissionRate: bookingProperty.commission || 0,
                landlordAmount: reservation.landlordAmount || 0
            },

            // Line Items
            itemDetails: [
                {
                    description: `Accommodation - ${unit.name} (${nights} ${nights === 1 ? 'night' : 'nights'})`,
                    unitPrice: reservation.basePrice || 0,
                    quantity: nights,
                    amount: (reservation.basePrice || 0) * nights
                }
            ],

            // Additional Services
            additionalItems: (reservation.additionalServices || []).map(service => ({
                description: service.serviceName,
                unitPrice: service.price,
                quantity: service.quantity || 1,
                amount: service.price * (service.quantity || 1)
            })),

            // Payment Information
            paymentDetails: {
                method: reservation.paymentMethod || 'Not specified',
                timing: reservation.paymentTiming || 'Before',
                status: getPaymentStatus(reservation)
            },

            // Currency Information
            currency: currency ? {
                id: currency._id,
                code: currency.currencyShortCode || 'USD',
                name: currency.currencyName || 'US Dollar',
                symbol: currency.symbol || '$'
            } : {
                code: 'USD',
                name: 'US Dollar',
                symbol: '$'
            },

            // Invoice Metadata
            invoiceDate: new Date(),
            dueDate: reservation.checkIn,
            status: 'draft',
            managementType: 'property_manager',

            // System Information
            generatedAt: new Date(),
            generatedBy: request.user?.id || 'system'
        };

        // Update reservation with invoice reference if not already present
        if (!reservation.invoiceId) {
            await models.bookingReservation.findByIdAndUpdate(
                reservationId,
                {
                    $set: {
                        invoiceId: invoiceData.invoiceNumber,
                        updatedBy: request.user?.id || null
                    }
                }
            );
        }

        return reply.code(200).send({
            success: true,
            message: 'Invoice data generated successfully for property manager unit',
            data: invoiceData
        });

    } catch (error) {
        return reply.code(500).send({
            success: false,
            error: error.message || 'An unexpected error occurred while generating invoice.'
        });
    }
};

/**
 * Determine payment status based on reservation data
 */
function getPaymentStatus(reservation) {
    if (reservation.status === 'completed') {
        return 'paid';
    } else if (reservation.status === 'canceled' || reservation.status === 'cancelled') {
        return 'cancelled';
    } else if (reservation.paymentTiming === 'Before') {
        return 'pending';
    } else {
        return 'due_after_checkout';
    }
}

module.exports = generate_booking_invoice;
