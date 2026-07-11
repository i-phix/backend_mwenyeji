const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

/**
 * Calculate revenue trends - ONLY for Property Manager managed units
 * Landlord managed units are excluded from all financial calculations
 */
const calculate_revenue_trends = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { period = 'monthly' } = request.query;

        // Validate period
        const validPeriods = ['monthly', 'quarterly', 'yearly'];
        if (!validPeriods.includes(period)) {
            return reply.code(400).send({
                success: false,
                error: `Invalid period. Must be one of: ${validPeriods.join(', ')}`
            });
        }

        // Get models with facility context
        const BookingReservation = await getModel('BookingReservation', payservedb.BookingReservation.schema, facilityId);
        const BookingProperty = await getModel('BookingProperty', payservedb.BookingProperty.schema, facilityId);
        const RevenueRecord = await getModel('RevenueRecord', payservedb.RevenueRecord.schema, facilityId);

        // Calculate date range based on period
        const dateRange = getDateRangeForPeriod(period);
        const { startDate, endDate } = dateRange;

        // Get ONLY property manager managed properties
        const propertyManagerProperties = await BookingProperty.find({
            facilityId,
            managedByLandlord: { $ne: true } // Only property manager managed
        }).select('_id');

        const propertyManagerIds = propertyManagerProperties.map(p => p._id);

        if (propertyManagerIds.length === 0) {
            return reply.code(200).send({
                success: true,
                data: [],
                message: "No property manager managed units found"
            });
        }

        // Try to get data from RevenueRecord first (more accurate)
        let revenueData = [];

        if (RevenueRecord) {
            revenueData = await getRevenueFromRecords(RevenueRecord, propertyManagerIds, period, dateRange);
        }

        // If no revenue records, calculate from completed reservations
        if (revenueData.length === 0) {
            revenueData = await getRevenueFromReservations(BookingReservation, propertyManagerIds, period, dateRange);
        }

        // Generate projections based on historical data
        const projectedRevenueData = generateProjections(revenueData, period);

        return reply.code(200).send({
            success: true,
            data: projectedRevenueData,
            metadata: {
                period,
                dateRange,
                propertyManagerUnitsCount: propertyManagerIds.length,
                note: "Revenue includes only Property Manager managed units"
            }
        });

    } catch (error) {
        return reply.code(500).send({
            success: false,
            error: error.message || 'An unexpected error occurred while calculating revenue trends'
        });
    }
};

/**
 * Get revenue data from RevenueRecord collection (property manager only)
 */
async function getRevenueFromRecords(RevenueRecord, propertyManagerIds, period, dateRange) {
    const { startDate, endDate } = dateRange;

    // Find revenue records for property manager units only
    const records = await RevenueRecord.find({
        bookingPropertyId: { $in: propertyManagerIds },
        checkoutDate: { $gte: startDate, $lte: endDate }
    });

    if (records.length === 0) {
        return [];
    }

    // Group records by period
    const groupedData = {};

    records.forEach(record => {
        let periodKey;
        const recordDate = new Date(record.checkoutDate);

        if (period === 'monthly') {
            const month = recordDate.toLocaleString('en-US', { month: 'short' });
            const year = recordDate.getFullYear();
            periodKey = `${month} ${year}`;
        } else if (period === 'quarterly') {
            const quarter = Math.floor(recordDate.getMonth() / 3) + 1;
            const year = recordDate.getFullYear();
            periodKey = `Q${quarter} ${year}`;
        } else {
            periodKey = recordDate.getFullYear().toString();
        }

        if (!groupedData[periodKey]) {
            groupedData[periodKey] = {
                name: periodKey,
                revenue: 0,
                count: 0,
                date: new Date(recordDate)
            };
        }

        // Use finalAmount for more accurate revenue
        groupedData[periodKey].revenue += record.finalAmount || record.baseAmount || 0;
        groupedData[periodKey].count += 1;
    });

    // Convert to array and sort chronologically
    const result = Object.values(groupedData)
        .sort((a, b) => a.date - b.date)
        .map(({ name, revenue, count, date }) => ({
            name,
            revenue: Math.round(revenue),
            count,
            date
        }));

    return result;
}

/**
 * Get revenue data from BookingReservation collection (property manager only)
 */
async function getRevenueFromReservations(BookingReservation, propertyManagerIds, period, dateRange) {
    const { startDate, endDate } = dateRange;

    // Find completed reservations for property manager units only
    const reservations = await BookingReservation.find({
        bookingPropertyId: { $in: propertyManagerIds },
        status: 'completed',
        $or: [
            { checkOutActual: { $exists: true, $ne: null, $gte: startDate, $lte: endDate } },
            { checkoutDate: { $exists: true, $ne: null, $gte: startDate, $lte: endDate } }
        ]
    });

    if (reservations.length === 0) {
        return [];
    }

    // Group by period
    const groupedData = {};

    reservations.forEach(reservation => {
        let periodKey;
        const checkoutDate = reservation.checkoutDate ?
            new Date(reservation.checkoutDate) :
            new Date(reservation.checkOutActual);

        if (period === 'monthly') {
            const month = checkoutDate.toLocaleString('en-US', { month: 'short' });
            const year = checkoutDate.getFullYear();
            periodKey = `${month} ${year}`;
        } else if (period === 'quarterly') {
            const quarter = Math.floor(checkoutDate.getMonth() / 3) + 1;
            const year = checkoutDate.getFullYear();
            periodKey = `Q${quarter} ${year}`;
        } else {
            periodKey = checkoutDate.getFullYear().toString();
        }

        if (!groupedData[periodKey]) {
            groupedData[periodKey] = {
                name: periodKey,
                revenue: 0,
                count: 0,
                date: new Date(checkoutDate)
            };
        }

        // Use finalAmount if available, fallback to totalAmount
        const amount = reservation.finalAmount || reservation.totalAmount || 0;
        groupedData[periodKey].revenue += amount;
        groupedData[periodKey].count += 1;
    });

    const result = Object.values(groupedData)
        .sort((a, b) => a.date - b.date)
        .map(({ name, revenue, count, date }) => ({
            name,
            revenue: Math.round(revenue),
            count,
            date
        }));

    return result;
}

/**
 * Generate simple projections based on historical data
 */
function generateProjections(historicalData, period) {
    if (!historicalData || historicalData.length === 0) {
        return [];
    }

    const dataWithProjections = [...historicalData];

    if (historicalData.length >= 2) {
        // Calculate simple average growth rate
        let totalGrowthRate = 0;
        let growthSamples = 0;

        for (let i = 1; i < historicalData.length; i++) {
            const prev = historicalData[i - 1].revenue;
            const current = historicalData[i].revenue;

            if (prev > 0) {
                const growthRate = (current - prev) / prev;
                totalGrowthRate += growthRate;
                growthSamples++;
            }
        }

        let avgGrowthRate = 0.05; // Default 5% growth

        if (growthSamples > 0) {
            avgGrowthRate = totalGrowthRate / growthSamples;
            // Keep growth rate reasonable (-20% to +50%)
            avgGrowthRate = Math.max(-0.2, Math.min(0.5, avgGrowthRate));
        }

        // Add forecast to existing data
        for (let i = 0; i < historicalData.length; i++) {
            const current = historicalData[i].revenue;
            const forecast = Math.round(current * (1 + avgGrowthRate));
            dataWithProjections[i].forecast = forecast;
        }
    } else {
        // Simple forecast for limited data
        dataWithProjections.forEach((item, index) => {
            item.forecast = Math.round(item.revenue * 1.1); // 10% growth
        });
    }

    return dataWithProjections.map(({ date, ...rest }) => rest);
}

/**
 * Get date range for the specified period
 */
function getDateRangeForPeriod(period) {
    const now = new Date();
    let startDate, endDate;

    if (period === 'monthly') {
        // Last 6 months
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 5);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
    } else if (period === 'quarterly') {
        // Last 6 quarters
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 17);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
    } else {
        // Last 3 years
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 2);
        startDate.setMonth(0, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
    }

    return { startDate, endDate };
}

module.exports = calculate_revenue_trends;