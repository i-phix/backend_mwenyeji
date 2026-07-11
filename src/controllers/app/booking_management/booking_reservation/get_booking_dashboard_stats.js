const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

/**
 * Get booking dashboard statistics
 * Revenue calculations ONLY for Property Manager managed units
 * Reservation counts include ALL units (both management types)
 */
const get_booking_dashboard_stats = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        
        // Get models with facility context
        const models = {
            bookingReservation: await getModel('BookingReservation', payservedb.BookingReservation.schema, facilityId),
            bookingProperty: await getModel('BookingProperty', payservedb.BookingProperty.schema, facilityId),
            unit: await getModel('Unit', payservedb.Unit.schema, facilityId)
        };

        // === UNIT STATISTICS ===
        const totalUnits = await models.unit.countDocuments({ facilityId });
        const totalListedProperties = await models.bookingProperty.countDocuments({ 
            facilityId, 
            isListed: true,
            status: 'Active'
        });
        
        // Breakdown by management type
        const landlordManagedCount = await models.bookingProperty.countDocuments({
            facilityId,
            isListed: true,
            status: 'Active',
            managedByLandlord: true
        });
        
        const propertyManagerManagedCount = await models.bookingProperty.countDocuments({
            facilityId,
            isListed: true,
            status: 'Active',
            managedByLandlord: { $ne: true }
        });

        const occupancyRate = totalUnits > 0 ? Math.round((totalListedProperties / totalUnits) * 100) : 0;

        // === RESERVATION STATISTICS (ALL TYPES) ===
        const totalReservations = await models.bookingReservation.countDocuments({ facilityId });
        const reservedReservations = await models.bookingReservation.countDocuments({
            facilityId,
            status: { $in: ['reserved', 'new'] }
        });
        const bookedReservations = await models.bookingReservation.countDocuments({
            facilityId,
            status: { $in: ['booked', 'confirmed'] }
        });
        const canceledReservations = await models.bookingReservation.countDocuments({
            facilityId,
            status: { $in: ['canceled', 'cancelled'] }
        });
        const completedReservations = await models.bookingReservation.countDocuments({
            facilityId,
            status: 'completed'
        });

        // === REVENUE STATISTICS (PROPERTY MANAGER ONLY) ===
        // Get property manager properties for revenue calculations
        const propertyManagerProperties = await models.bookingProperty.find({
            facilityId,
            managedByLandlord: { $ne: true }
        }).select('_id');

        const propertyManagerIds = propertyManagerProperties.map(p => p._id);

        // Current month revenue (property manager only)
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        let totalRevenue = 0;
        let pmCommission = 0;
        let landlordRevenue = 0;

        if (propertyManagerIds.length > 0) {
            const monthlyReservations = await models.bookingReservation.find({
                facilityId,
                bookingPropertyId: { $in: propertyManagerIds },
                status: { $in: ['booked', 'completed', 'confirmed'] },
                createdAt: { $gte: startOfMonth, $lte: endOfMonth }
            });

            monthlyReservations.forEach(reservation => {
                totalRevenue += reservation.finalAmount || reservation.totalAmount || 0;
                pmCommission += reservation.commission || 0;
                landlordRevenue += reservation.landlordAmount || 0;
            });
        }

        // === CHART DATA ===
        const monthlyRevenueData = await getMonthlyRevenueData(models.bookingReservation, models.bookingProperty, facilityId);
        const weeklyTrendData = await getWeeklyTrendData(models.bookingReservation, facilityId);

        return reply.code(200).send({
            success: true,
            data: {
                units: {
                    totalUnits,
                    totalListedProperties,
                    landlordManagedCount,
                    propertyManagerManagedCount,
                    occupancyRate,
                    breakdown: {
                        landlordManaged: landlordManagedCount,
                        propertyManagerManaged: propertyManagerManagedCount,
                        notListed: totalUnits - totalListedProperties
                    }
                },
                reservations: {
                    totalReservations,
                    reservedReservations,
                    bookedReservations,
                    canceledReservations,
                    completedReservations,
                    // Legacy keys for backward compatibility
                    pendingReservations: reservedReservations,
                    confirmedReservations: bookedReservations,
                    cancelledReservations: canceledReservations,
                    breakdown: {
                        active: reservedReservations + bookedReservations,
                        inactive: canceledReservations + completedReservations
                    }
                },
                revenue: {
                    currentMonth: {
                        totalRevenue: Math.round(totalRevenue),
                        pmCommission: Math.round(pmCommission),
                        landlordRevenue: Math.round(landlordRevenue),
                        projectedMonthEnd: Math.round(totalRevenue * 1.2)
                    },
                    propertyManagerUnitsCount: propertyManagerIds.length,
                    note: "Revenue data includes only Property Manager managed units"
                },
                charts: {
                    monthlyRevenue: monthlyRevenueData,
                    weeklyTrend: weeklyTrendData
                }
            }
        });

    } catch (error) {
        return reply.code(500).send({ 
            success: false,
            error: error.message || 'An unexpected error occurred while fetching dashboard stats.'
        });
    }
};

/**
 * Get monthly revenue data for chart (property manager managed units only)
 */
async function getMonthlyRevenueData(bookingReservationModel, bookingPropertyModel, facilityId) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentMonth = new Date().getMonth();
    
    // Get property manager properties
    const propertyManagerProperties = await bookingPropertyModel.find({
        facilityId,
        managedByLandlord: { $ne: true }
    }).select('_id');

    const propertyManagerIds = propertyManagerProperties.map(p => p._id);
    
    if (propertyManagerIds.length === 0) {
        // Return empty data if no property manager units
        return months.slice(currentMonth - 5 < 0 ? currentMonth + 7 : currentMonth - 5, currentMonth + 1)
            .map(month => ({
                name: month,
                revenue: 0,
                pmCommission: 0,
                landlordRevenue: 0,
                projectedRevenue: 0
            }));
    }
    
    const data = [];
    
    // Get last 6 months data
    for (let i = 5; i >= 0; i--) {
        const monthIdx = (currentMonth - i + 12) % 12;
        const year = new Date().getFullYear() - (currentMonth < i ? 1 : 0);
        
        const startDate = new Date(year, monthIdx, 1);
        const endDate = new Date(year, monthIdx + 1, 0);
        
        const reservations = await bookingReservationModel.find({
            facilityId,
            bookingPropertyId: { $in: propertyManagerIds },
            status: { $in: ['booked', 'completed', 'confirmed'] },
            createdAt: { $gte: startDate, $lte: endDate }
        });
        
        let revenue = 0;
        let pmCommission = 0;
        let landlordRevenue = 0;
        
        reservations.forEach(reservation => {
            revenue += reservation.finalAmount || reservation.totalAmount || 0;
            pmCommission += reservation.commission || 0;
            landlordRevenue += reservation.landlordAmount || 0;
        });
        
        // Simple projection calculation
        const projectedRevenue = revenue > 0 ? Math.round(revenue * 1.15) : 0;
        
        data.push({
            name: months[monthIdx],
            revenue: Math.round(revenue),
            pmCommission: Math.round(pmCommission),
            landlordRevenue: Math.round(landlordRevenue),
            projectedRevenue
        });
    }
    
    return data;
}

/**
 * Get weekly reservation trend data (includes ALL reservations - both management types)
 * This is appropriate since we want to see all booking activity trends
 */
async function getWeeklyTrendData(bookingReservationModel, facilityId) {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    // Get start of week (Monday)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
    startOfWeek.setHours(0, 0, 0, 0);
    
    const data = [];
    
    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(startOfWeek);
        currentDate.setDate(startOfWeek.getDate() + i);
        
        const nextDate = new Date(currentDate);
        nextDate.setDate(currentDate.getDate() + 1);
        
        // Count all reservations regardless of management type
        const reservedCount = await bookingReservationModel.countDocuments({
            facilityId,
            status: 'reserved',
            createdAt: { $gte: currentDate, $lt: nextDate }
        });

        const bookedCount = await bookingReservationModel.countDocuments({
            facilityId,
            status: 'booked',
            updatedAt: { $gte: currentDate, $lt: nextDate }
        });

        const completedReservations = await bookingReservationModel.countDocuments({
            facilityId,
            status: 'completed',
            updatedAt: { $gte: currentDate, $lt: nextDate }
        });

        data.push({
            name: days[i],
            reserved: reservedCount,
            booked: bookedCount,
            completed: completedReservations,
            total: reservedCount + bookedCount + completedReservations
        });
    }
    
    return data;
}

module.exports = get_booking_dashboard_stats;
