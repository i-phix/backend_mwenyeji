const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

/**
 * Calculate Pricing for External Booking API
 * Returns detailed pricing breakdown including base price, taxes, fees, and total
 */
const calculate_pricing = async (request, reply) => {
    try {
        const {
            facility_id,
            property_id,
            check_in_date,
            check_out_date,
            adults,
            children
        } = request.body;

        // Validate facility_id
        if (!facility_id) {
            return reply.code(400).send({
                success: false,
                error: 'Missing facility ID',
                message: 'facility_id is required in request body'
            });
        }

        const facilityId = facility_id;

        // Validate required fields
        if (!property_id || !check_in_date || !check_out_date) {
            return reply.code(400).send({
                success: false,
                error: 'Missing required fields',
                message: 'property_id, check_in_date, and check_out_date are required',
                required_fields: ['property_id', 'check_in_date', 'check_out_date']
            });
        }

        // Validate date format and logic
        const checkIn = new Date(check_in_date);
        const checkOut = new Date(check_out_date);

        if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid date format',
                message: 'Dates must be in YYYY-MM-DD format'
            });
        }

        if (checkOut <= checkIn) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid date range',
                message: 'Check-out date must be after check-in date'
            });
        }

        // Get models
        const BookingProperty = await getModel('BookingProperty', payservedb.BookingProperty.schema, facilityId);
        const Currency = await getModel('Currency', payservedb.Currency.schema, facilityId);

        // Fetch property
        const property = await BookingProperty.findById(property_id);
        if (!property) {
            return reply.code(404).send({
                success: false,
                error: 'Property not found',
                message: `No property found with ID: ${property_id}`
            });
        }

        if (!property.isListed) {
            return reply.code(400).send({
                success: false,
                error: 'Property not available',
                message: 'This property is not currently available for booking'
            });
        }

        // Normalize dates
        const normalizeDate = (dateStr) => {
            const date = new Date(dateStr);
            return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
        };

        const checkInNormalized = normalizeDate(check_in_date);
        const checkOutNormalized = normalizeDate(check_out_date);

        // Calculate nights
        const nights = Math.ceil((checkOutNormalized - checkInNormalized) / (1000 * 60 * 60 * 24));

        // Get base price
        const basePrice = property.basePrice || 0;
        const accommodationTotal = basePrice * nights;

        // Get currency details
        let currency = { code: 'USD', name: 'US Dollar', exchange_rate: 1 };
        if (property.currencyId) {
            const curr = await Currency.findById(property.currencyId);
            if (curr) {
                currency = {
                    code: curr.currencyShortCode,
                    name: curr.currencyName,
                    exchange_rate: curr.exchangeRate
                };
            }
        }

        // Calculate additional fees (if any configured on property)
        let cleaningFee = 0;
        let serviceFee = 0;
        let taxAmount = 0;

        // Check if property has pricing rules or fees configured
        if (property.pricingRules) {
            cleaningFee = property.pricingRules.cleaningFee || 0;
            serviceFee = property.pricingRules.serviceFee || 0;

            // Calculate tax if configured
            if (property.pricingRules.taxRate) {
                taxAmount = accommodationTotal * (property.pricingRules.taxRate / 100);
            }
        }

        // Calculate guest-based fees (if property charges per guest)
        let guestFee = 0;
        const totalGuests = (adults || 0) + (children || 0);
        if (property.pricingRules?.perGuestFee && totalGuests > 0) {
            guestFee = property.pricingRules.perGuestFee * totalGuests;
        }

        // Calculate total
        const subtotal = accommodationTotal + cleaningFee + serviceFee + guestFee;
        const total = subtotal + taxAmount;

        // Build detailed breakdown
        const breakdown = {
            accommodation: {
                base_price_per_night: basePrice,
                nights: nights,
                total: accommodationTotal
            },
            fees: {
                cleaning_fee: cleaningFee,
                service_fee: serviceFee,
                guest_fee: guestFee
            },
            tax: {
                rate: property.pricingRules?.taxRate || 0,
                amount: taxAmount
            },
            summary: {
                subtotal: subtotal,
                tax: taxAmount,
                total: total
            }
        };

        // Build response
        const response = {
            success: true,
            message: 'Pricing calculated successfully',
            data: {
                property_id: property_id,
                check_in_date: check_in_date,
                check_out_date: check_out_date,
                nights: nights,
                guests: {
                    adults: adults || 0,
                    children: children || 0,
                    total: totalGuests
                },
                pricing: breakdown,
                currency: currency.code,
                currency_details: {
                    code: currency.code,
                    name: currency.name,
                    exchange_rate: currency.exchange_rate
                },
                policies: {
                    cancellation_policy: property.cancellationPolicy || 'Standard cancellation policy applies',
                    payment_deadline: property.paymentDeadline || 'Payment required within 24 hours of reservation'
                }
            }
        };

        return reply.code(200).send(response);

    } catch (error) {
        console.error('Error in calculate_pricing (external API):', error);
        return reply.code(500).send({
            success: false,
            error: 'Internal server error',
            message: 'An error occurred while calculating pricing'
        });
    }
};

module.exports = calculate_pricing;
