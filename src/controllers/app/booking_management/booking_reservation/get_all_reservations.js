const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const normalizeStatus = (value) => {
    if (!value) return null;
    const statusMap = {
        new: 'reserved',
        confirmed: 'booked',
        cancelled: 'canceled',
        canceled: 'canceled',
        reserved: 'reserved',
        booked: 'booked',
        completed: 'completed'
    };
    return statusMap[value] || value;
};

/**
 * Get all reservations with management type information
 * Returns ALL reservations but includes management type for frontend filtering/display
 */
const get_all_reservations = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            status,
            startDate,
            endDate,
            limit = 10,
            page = 1,
            propertyId,
            unitId,
            managementType // New filter: 'landlord', 'property_manager', or 'all'
        } = request.query;

        // Get models with facility context
        const BookingReservation = await getModel('BookingReservation', payservedb.BookingReservation.schema, facilityId);
        const Unit = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const BookingProperty = await getModel('BookingProperty', payservedb.BookingProperty.schema, facilityId);
        const Currency = await getModel('Currency', payservedb.Currency.schema, facilityId);

        // Build base query filters
        const filters = { facilityId };

        // Status filter
        if (status) {
            const normalizedStatus = normalizeStatus(status);
            if (normalizedStatus === 'reserved') {
                filters.status = { $in: ['reserved', 'new'] };
            } else if (normalizedStatus === 'booked') {
                filters.status = { $in: ['booked', 'confirmed'] };
            } else if (normalizedStatus === 'canceled') {
                filters.status = { $in: ['canceled', 'cancelled'] };
            } else {
                filters.status = normalizedStatus;
            }
        }

        // Property filter
        if (propertyId) {
            filters.bookingPropertyId = propertyId;
        }

        // Unit filter
        if (unitId) {
            filters.unitId = unitId;
        }

        // Management type filter
        if (managementType && managementType !== 'all') {
            const managementFilter = managementType === 'landlord' ? true : { $ne: true };

            // Get properties by management type
            const propertiesByType = await BookingProperty.find({
                facilityId,
                managedByLandlord: managementFilter
            }).select('_id');

            const propertyIds = propertiesByType.map(p => p._id);
            if (propertyIds.length > 0) {
                filters.bookingPropertyId = { $in: propertyIds };
            } else {
                // No properties of this type exist, return empty result
                return reply.code(200).send({
                    success: true,
                    data: [],
                    pagination: {
                        total: 0,
                        page: parseInt(page),
                        pages: 0,
                        limit: parseInt(limit)
                    }
                });
            }
        }

        // Date filtering
        if (startDate && endDate) {
            filters.$or = [
                {
                    checkIn: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    }
                },
                {
                    checkOut: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    }
                },
                {
                    $and: [
                        { checkIn: { $lte: new Date(startDate) } },
                        { checkOut: { $gte: new Date(endDate) } }
                    ]
                }
            ];
        } else if (startDate) {
            filters.checkIn = { $gte: new Date(startDate) };
        } else if (endDate) {
            filters.checkOut = { $lte: new Date(endDate) };
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = parseInt(limit);

        // Get total count for pagination
        const total = await BookingReservation.countDocuments(filters);

        // Get reservations with populated references
        const reservations = await BookingReservation
            .find(filters)
            .skip(skip)
            .limit(limitNum)
            .populate({
                path: 'unitId',
                model: Unit,
                select: 'name unitType division floorUnitNo'
            })
            .populate({
                path: 'bookingPropertyId',
                model: BookingProperty,
                select: 'propertyName propertyType managedByLandlord basePrice commission'
            })
            .populate({
                path: 'currencyId',
                model: Currency,
                select: 'currencyName currencyShortCode symbol'
            })
            .sort({ createdAt: -1 });

        // Process reservations with additional calculated fields
        const reservationsWithDetails = reservations.map(reservation => {
            const checkIn = new Date(reservation.checkIn);
            const checkOut = new Date(reservation.checkOut);
            const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

            const isLandlordManaged = reservation.bookingPropertyId?.managedByLandlord || false;
            const managementType = isLandlordManaged ? 'landlord' : 'property_manager';

            // Current date for status determination
            const now = new Date();
            const isUpcoming = checkIn > now;
            const isActive = checkIn <= now && checkOut >= now;
            const isPast = checkOut < now;

            const reservationObj = reservation.toObject();
            return {
                ...reservationObj,
                nights,
                managementType,
                isLandlordManaged,
                calculatedFields: {
                    isUpcoming,
                    isActive,
                    isPast,
                    daysUntilCheckIn: isUpcoming ? Math.ceil((checkIn - now) / (1000 * 60 * 60 * 24)) : 0,
                    daysUntilCheckOut: isActive ? Math.ceil((checkOut - now) / (1000 * 60 * 60 * 24)) : 0
                },
                // Only include financial details for property manager units
                financialSummary: isLandlordManaged ? null : {
                    totalAmount: reservation.totalAmount || 0,
                    commission: reservation.commission || 0,
                    landlordAmount: reservation.landlordAmount || 0,
                    finalAmount: reservation.finalAmount || reservation.totalAmount || 0
                }
            };
        });

        // Calculate summary statistics for the filtered results
        const summaryStats = calculateSummaryStats(reservationsWithDetails);

        return reply.code(200).send({
            success: true,
            data: reservationsWithDetails,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limitNum),
                limit: limitNum
            },
            summary: summaryStats
        });

    } catch (error) {
        return reply.code(500).send({
            success: false,
            error: error.message || 'An unexpected error occurred while fetching reservations.'
        });
    }
};

/**
 * Calculate summary statistics for the current page/filter results
 */
function calculateSummaryStats(reservations) {
        const stats = {
        total: reservations.length,
        byStatus: {
            reserved: 0,
            booked: 0,
            canceled: 0,
            completed: 0
        },
        byManagementType: {
            landlord: 0,
            property_manager: 0
        },
        byTimeStatus: {
            upcoming: 0,
            active: 0,
            past: 0
        },
        revenue: {
            totalPropertyManager: 0,
            totalCommission: 0,
            note: "Revenue totals include only Property Manager managed units"
        }
    };

    reservations.forEach(reservation => {
        // Count by status
        const normalizedStatus = normalizeStatus(reservation.status);
        stats.byStatus[normalizedStatus] = (stats.byStatus[normalizedStatus] || 0) + 1;

        // Count by management type
        stats.byManagementType[reservation.managementType] += 1;

        // Count by time status
        if (reservation.calculatedFields.isUpcoming) {
            stats.byTimeStatus.upcoming += 1;
        } else if (reservation.calculatedFields.isActive) {
            stats.byTimeStatus.active += 1;
        } else {
            stats.byTimeStatus.past += 1;
        }

        // Add to revenue totals (property manager only)
        if (reservation.financialSummary) {
            stats.revenue.totalPropertyManager += reservation.financialSummary.finalAmount;
            stats.revenue.totalCommission += reservation.financialSummary.commission;
        }
    });

    // Round revenue totals
    stats.revenue.totalPropertyManager = Math.round(stats.revenue.totalPropertyManager);
    stats.revenue.totalCommission = Math.round(stats.revenue.totalCommission);

    return stats;
}

module.exports = get_all_reservations;
