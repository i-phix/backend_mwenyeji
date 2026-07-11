const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

/**
 * Get reservation trend data with management type breakdown
 * Shows trends for both landlord and property manager units with separate tracking
 */
const get_reservation_trend = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            period = 'thisWeek',
            managementType = 'all' // 'all', 'landlord', 'property_manager'
        } = request.query;

        // Get models with facility context
        const BookingReservation = await getModel('BookingReservation', payservedb.BookingReservation.schema, facilityId);
        const BookingProperty = await getModel('BookingProperty', payservedb.BookingProperty.schema, facilityId);

        // Calculate date range based on period
        const { startDate, endDate } = getDateRangeForPeriod(period);

        // Build base query
        const baseQuery = {
            facilityId,
            createdAt: { $gte: startDate, $lte: endDate }
        };

        // Apply management type filter if specified
        if (managementType !== 'all') {
            const managementFilter = managementType === 'landlord' ? true : { $ne: true };

            // Get properties by management type
            const propertiesByType = await BookingProperty.find({
                facilityId,
                managedByLandlord: managementFilter
            }).select('_id');

            const propertyIds = propertiesByType.map(p => p._id);

            if (propertyIds.length === 0) {
                // No properties of this type, return empty trend data
                const emptyTrendData = generateEmptyTrendData(period);
                return reply.code(200).send({
                    success: true,
                    data: emptyTrendData,
                    metadata: {
                        period,
                        managementType,
                        message: `No ${managementType} managed units found`
                    }
                });
            }

            baseQuery.bookingPropertyId = { $in: propertyIds };
        }

        // Fetch reservations in the date range
        const reservations = await BookingReservation.find(baseQuery)
            .populate({
                path: 'bookingPropertyId',
                model: BookingProperty,
                select: 'managedByLandlord propertyName'
            })
            .sort({ createdAt: 1 });

        // Process reservations into trend data
        const trendData = processReservationTrend(reservations, period, managementType);

        // Calculate summary statistics
        const summaryStats = calculateTrendSummary(reservations, managementType);

        return reply.code(200).send({
            success: true,
            data: trendData,
            summary: summaryStats,
            metadata: {
                period,
                managementType,
                dateRange: { startDate, endDate },
                totalReservations: reservations.length
            }
        });

    } catch (error) {
        return reply.code(500).send({
            success: false,
            error: error.message || 'An unexpected error occurred while fetching reservation trend data.'
        });
    }
};

/**
 * Calculate date range based on period
 */
const getDateRangeForPeriod = (period) => {
    const now = new Date();
    const startDate = new Date();
    const endDate = new Date();

    if (period === 'thisWeek') {
        // Current week (Sunday to Saturday)
        startDate.setDate(now.getDate() - now.getDay());
        endDate.setDate(startDate.getDate() + 6);
    } else if (period === 'lastWeek') {
        // Last week (Sunday to Saturday)
        startDate.setDate(now.getDate() - now.getDay() - 7);
        endDate.setDate(startDate.getDate() + 6);
    } else if (period === 'last30Days') {
        // Last 30 days
        startDate.setDate(now.getDate() - 29);
        endDate.setDate(now.getDate());
    } else if (period === 'thisMonth') {
        // Current month
        startDate.setDate(1);
        endDate.setMonth(now.getMonth() + 1, 0);
    } else if (period === 'lastMonth') {
        // Previous month
        startDate.setMonth(now.getMonth() - 1, 1);
        endDate.setMonth(now.getMonth(), 0);
    } else {
        // Default to current week
        startDate.setDate(now.getDate() - now.getDay());
        endDate.setDate(startDate.getDate() + 6);
    }

    // Reset hours to get full days
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
};

/**
 * Process reservations into trend data
 */
const processReservationTrend = (reservations, period, managementType) => {
    const trendMap = {};
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Initialize the trend map with all days/periods
    const { startDate, endDate } = getDateRangeForPeriod(period);
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        let displayKey;

        if (period === 'thisWeek' || period === 'lastWeek') {
            displayKey = days[currentDate.getDay()];
        } else if (period === 'last30Days') {
            displayKey = `${currentDate.getDate()} ${months[currentDate.getMonth()]}`;
        } else if (period === 'thisMonth' || period === 'lastMonth') {
            displayKey = `${currentDate.getDate()}`;
        } else {
            displayKey = currentDate.toISOString().split('T')[0];
        }

        if (!trendMap[displayKey]) {
            trendMap[displayKey] = {
                name: displayKey,
                reserved: 0,
                booked: 0,
                completed: 0,
                canceled: 0,
                total: 0,
                date: new Date(currentDate)
            };

            // Add management type breakdown if showing all types
            if (managementType === 'all') {
                trendMap[displayKey].landlordManaged = 0;
                trendMap[displayKey].propertyManagerManaged = 0;
            }
        }

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Process each reservation
    reservations.forEach(reservation => {
        const creationDate = new Date(reservation.createdAt);
        let displayKey;

        if (period === 'thisWeek' || period === 'lastWeek') {
            displayKey = days[creationDate.getDay()];
        } else if (period === 'last30Days') {
            displayKey = `${creationDate.getDate()} ${months[creationDate.getMonth()]}`;
        } else if (period === 'thisMonth' || period === 'lastMonth') {
            displayKey = `${creationDate.getDate()}`;
        } else {
            displayKey = creationDate.toISOString().split('T')[0];
        }

        // Only count if this day is in our map
        if (trendMap[displayKey]) {
            // Increment status counter
            const normalizeStatus = (value) => {
                const statusMap = {
                    new: 'reserved',
                    confirmed: 'booked',
                    cancelled: 'canceled',
                    canceled: 'canceled',
                    reserved: 'reserved',
                    booked: 'booked',
                    completed: 'completed'
                };
                return statusMap[value] || 'reserved';
            };
            const status = normalizeStatus(reservation.status || 'reserved');
            if (trendMap[displayKey][status] !== undefined) {
                trendMap[displayKey][status] += 1;
            }

            // Increment total
            trendMap[displayKey].total += 1;

            // Add management type breakdown if showing all types
            if (managementType === 'all') {
                const isLandlordManaged = reservation.bookingPropertyId?.managedByLandlord || false;
                if (isLandlordManaged) {
                    trendMap[displayKey].landlordManaged += 1;
                } else {
                    trendMap[displayKey].propertyManagerManaged += 1;
                }
            }
        }
    });

    // Convert to array and sort by date
    const result = Object.values(trendMap).sort((a, b) => a.date - b.date);

    // Remove the date property as it's not needed in the response
    return result.map(({ date, ...rest }) => rest);
};

/**
 * Generate empty trend data structure for periods with no data
 */
function generateEmptyTrendData(period) {
    const { startDate, endDate } = getDateRangeForPeriod(period);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const emptyData = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        let displayKey;

        if (period === 'thisWeek' || period === 'lastWeek') {
            displayKey = days[currentDate.getDay()];
        } else if (period === 'last30Days') {
            displayKey = `${currentDate.getDate()} ${months[currentDate.getMonth()]}`;
        } else if (period === 'thisMonth' || period === 'lastMonth') {
            displayKey = `${currentDate.getDate()}`;
        } else {
            displayKey = currentDate.toISOString().split('T')[0];
        }

        emptyData.push({
            name: displayKey,
            reserved: 0,
            booked: 0,
            completed: 0,
            canceled: 0,
            total: 0
        });

        currentDate.setDate(currentDate.getDate() + 1);
    }

    return emptyData;
}

/**
 * Calculate summary statistics for the trend data
 */
function calculateTrendSummary(reservations, managementType) {
    const summary = {
        totalReservations: reservations.length,
        byStatus: {
            reserved: 0,
            booked: 0,
            completed: 0,
            canceled: 0
        },
        dailyAverage: 0
    };

    // Add management type breakdown if showing all
    if (managementType === 'all') {
        summary.byManagementType = {
            landlordManaged: 0,
            propertyManagerManaged: 0
        };
    }

    // Process reservations for summary
    reservations.forEach(reservation => {
        const normalizeStatus = (value) => {
            const statusMap = {
                new: 'reserved',
                confirmed: 'booked',
                cancelled: 'canceled',
                canceled: 'canceled',
                reserved: 'reserved',
                booked: 'booked',
                completed: 'completed'
            };
            return statusMap[value] || 'reserved';
        };
        const status = normalizeStatus(reservation.status || 'reserved');
        if (summary.byStatus[status] !== undefined) {
            summary.byStatus[status] += 1;
        }

        // Management type breakdown
        if (managementType === 'all') {
            const isLandlordManaged = reservation.bookingPropertyId?.managedByLandlord || false;
            if (isLandlordManaged) {
                summary.byManagementType.landlordManaged += 1;
            } else {
                summary.byManagementType.propertyManagerManaged += 1;
            }
        }
    });

    // Calculate daily average
    const { startDate, endDate } = getDateRangeForPeriod('thisWeek'); // Use week for calculation
    const daysDifference = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    summary.dailyAverage = daysDifference > 0 ? Math.round((reservations.length / daysDifference) * 10) / 10 : 0;

    return summary;
}

module.exports = get_reservation_trend;
