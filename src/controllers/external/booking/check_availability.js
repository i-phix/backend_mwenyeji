const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

/**
 * Check Availability for External Booking API
 * Wrapper around internal check_available_dates logic
 */
const check_availability = async (request, reply) => {
    try {
        const {
            facility_id,
            property_id,
            unit_id,
            check_in_date,
            check_out_date,
            guests
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
        if (!property_id || !unit_id || !check_in_date || !check_out_date) {
            return reply.code(400).send({
                success: false,
                error: 'Missing required fields',
                message: 'property_id, unit_id, check_in_date, and check_out_date are required',
                required_fields: ['property_id', 'unit_id', 'check_in_date', 'check_out_date']
            });
        }

        // Validate date format (must be YYYY-MM-DD)
        const dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateFormatRegex.test(check_in_date) || !dateFormatRegex.test(check_out_date)) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid date format',
                message: 'Dates must be in YYYY-MM-DD format',
                example: '2025-12-01'
            });
        }

        // Validate date logic
        const checkIn = new Date(check_in_date);
        const checkOut = new Date(check_out_date);

        if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid date',
                message: 'Please provide valid dates'
            });
        }

        if (checkOut <= checkIn) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid date range',
                message: 'Check-out date must be after check-in date'
            });
        }

        // Check if dates are in the past
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (checkIn < today) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid date',
                message: 'Check-in date cannot be in the past'
            });
        }

        // Validate property_id format (MongoDB ObjectId)
        if (!mongoose.Types.ObjectId.isValid(property_id)) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid property ID',
                message: 'Property ID must be a valid MongoDB ObjectId'
            });
        }

        // Validate unit_id format
        if (!mongoose.Types.ObjectId.isValid(unit_id)) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid unit ID',
                message: 'Unit ID must be a valid MongoDB ObjectId'
            });
        }

        // Get models
        const BookingProperty = await getModel('BookingProperty', payservedb.BookingProperty.schema, facilityId);
        const BookingReservation = await getModel('BookingReservation', payservedb.BookingReservation.schema, facilityId);
        const Unit = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const Currency = await getModel('Currency', payservedb.Currency.schema, facilityId);

        // Verify property exists and is listed
        const property = await BookingProperty.findById(property_id);
        if (!property) {
            return reply.code(404).send({
                success: false,
                available: false,
                error: 'Property not found',
                message: `No property found with ID: ${property_id}`
            });
        }

        if (!property.isListed) {
            return reply.code(400).send({
                success: false,
                available: false,
                error: 'Property not available',
                message: 'This property is not currently available for booking'
            });
        }

        // Verify unit exists
        const unit = await Unit.findById(unit_id);
        if (!unit) {
            return reply.code(404).send({
                success: false,
                available: false,
                error: 'Unit not found',
                message: `No unit found with ID: ${unit_id}`
            });
        }

        // Normalize dates (remove time component)
        const normalizeDate = (dateStr) => {
            const date = new Date(dateStr);
            return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
        };

        const checkInNormalized = normalizeDate(check_in_date);
        const checkOutNormalized = normalizeDate(check_out_date);

        // Check for conflicting reservations
        const conflictingReservations = await BookingReservation.find({
            bookingPropertyId: property_id,
            unitId: unit_id,
            status: { $in: ['reserved', 'booked'] },
            $or: [
                {
                    checkIn: { $lt: checkOutNormalized },
                    checkOut: { $gt: checkInNormalized }
                }
            ]
        });

        // Check for blocked dates
        let blockedDates = [];
        if (property.blockedDates && property.blockedDates.length > 0) {
            blockedDates = property.blockedDates.filter(block => {
                const blockStart = normalizeDate(block.startDate);
                const blockEnd = normalizeDate(block.endDate);
                return blockStart <= checkOutNormalized && blockEnd >= checkInNormalized;
            });
        }

        const isAvailable = conflictingReservations.length === 0 && blockedDates.length === 0;

        // Calculate pricing
        const nights = Math.ceil((checkOutNormalized - checkInNormalized) / (1000 * 60 * 60 * 24));
        const basePrice = property.basePrice || 0;
        const totalAmount = basePrice * nights;

        // Get currency details
        let currency = { code: 'USD', name: 'US Dollar' };
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

        // Collect unavailable dates if not available
        let unavailableDates = [];
        if (!isAvailable) {
            conflictingReservations.forEach(res => {
                const start = new Date(res.checkIn);
                const end = new Date(res.checkOut);
                for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
                    unavailableDates.push(d.toISOString().split('T')[0]);
                }
            });

            blockedDates.forEach(block => {
                const start = new Date(block.startDate);
                const end = new Date(block.endDate);
                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    unavailableDates.push(d.toISOString().split('T')[0]);
                }
            });

            // Remove duplicates
            unavailableDates = [...new Set(unavailableDates)].sort();
        }

        // Build response
        const response = {
            success: true,
            available: isAvailable,
            data: {
                property_id: property_id,
                unit_id: unit_id,
                check_in_date: check_in_date,
                check_out_date: check_out_date,
                nights: nights,
                pricing: {
                    base_price_per_night: basePrice,
                    total_amount: totalAmount,
                    currency: currency.code,
                    currency_details: currency
                }
            }
        };

        if (!isAvailable) {
            response.message = 'Unit is not available for the selected dates';
            response.unavailable_dates = unavailableDates;
            response.conflicts = {
                existing_reservations: conflictingReservations.length,
                blocked_dates: blockedDates.length
            };
        } else {
            response.message = 'Unit is available for the selected dates';
        }

        return reply.code(200).send(response);

    } catch (error) {
        console.error('Error in check_availability (external API):', error);
        return reply.code(500).send({
            success: false,
            available: false,
            error: 'Internal server error',
            message: 'An error occurred while checking availability'
        });
    }
};

module.exports = check_availability;
