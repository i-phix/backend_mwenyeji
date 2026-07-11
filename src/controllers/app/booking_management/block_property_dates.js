const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const block_property_dates = async (request, reply) => {
    try {
        const { facilityId, propertyId } = request.params;
        const { startDate, endDate, reason, notes } = request.body;
        
        // Log the incoming dates for debugging
        // console.log('Incoming dates in block_property_dates:', {
        //     startDate,
        //     endDate,
        //     reason,
        //     notes
        // });
        
        // Validate required fields
        if (!startDate || !endDate || !reason) {
            return reply.code(400).send({ 
                success: false,
                error: 'Start date, end date, and reason are required.' 
            });
        }

        // Get models with facility context
        const models = {
            bookingProperty: await getModel('BookingProperty', payservedb.BookingProperty.schema, facilityId)
        };

        // Check if property exists
        const property = await models.bookingProperty.findById(propertyId);
        if (!property) {
            return reply.code(404).send({ 
                success: false,
                error: `Booking property with ID ${propertyId} does not exist.` 
            });
        }

        // CRITICAL FIX: Proper date handling to prevent month shift
        const createLocalDate = (dateStr) => {
            // Parse the date string to create a Date object
            const originalDate = new Date(dateStr);
            
            // Extract date components in the local timezone
            const year = originalDate.getFullYear();
            const month = originalDate.getMonth(); // Important: keep month as-is (0-11)
            const day = originalDate.getDate();
            
            // Create a new date with these components at midnight
            // This ensures the date is treated consistently
            const localDate = new Date(year, month, day, 0, 0, 0, 0);
            
            // Log the transformation for debugging
            // console.log(`Date transformation:`, {
            //     original: originalDate.toString(),
            //     originalMonth: originalDate.getMonth(),
            //     year: year,
            //     month: month,
            //     day: day,
            //     transformed: localDate.toString(),
            //     transformedMonth: localDate.getMonth()
            // });
            
            return localDate;
        };

        // Create normalized dates with our fix
        const normalizedStartDate = createLocalDate(startDate);
        const normalizedEndDate = createLocalDate(endDate);
        
        // Log normalized dates for debugging
        // console.log('Normalized dates in block_property_dates:', {
        //     startDate: normalizedStartDate.toString(),
        //     startMonth: normalizedStartDate.getMonth(),
        //     endDate: normalizedEndDate.toString(),
        //     endMonth: normalizedEndDate.getMonth()
        // });

        // Add the blocked date using our properly normalized dates
        property.blockedDates.push({
            startDate: normalizedStartDate,
            endDate: normalizedEndDate,
            reason,
            notes: notes || ''
        });

        // Save the updated property
        await property.save();

        return reply.code(200).send({
            success: true,
            message: 'Dates blocked successfully',
            data: property
        });

    } catch (error) {
        //console.error('Error in block_property_dates:', error);
        
        return reply.code(500).send({ 
            success: false,
            error: error.message || 'An unexpected error occurred while blocking dates.'
        });
    }
};

module.exports = block_property_dates;