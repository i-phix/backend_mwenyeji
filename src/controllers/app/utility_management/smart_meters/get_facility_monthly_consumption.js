const { ObjectId } = require('mongoose').Types;
const utilityDb = require('../../../../middlewares/utilityDb');

/**
 * Get total water consumption per month for ALL meters in a facility
 * Accepts multiple months as query param: ?months=2026-01,2026-02,2026-03
 * Or a date range: ?startMonth=2026-01&endMonth=2026-03
 */
const get_facility_monthly_consumption = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { months, startMonth, endMonth } = request.query;

        // Validate facilityId
        if (!facilityId) {
            return reply.code(400).send({
                success: false,
                error: 'facilityId is required'
            });
        }

        if (!facilityId.match(/^[0-9a-fA-F]{24}$/)) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid facility ID format'
            });
        }

        // Get the WaterMeter model to find all meters in this facility
        const WaterMeter = await utilityDb.getModel('WaterMeter');
        const MonthlyWaterMeterHistory = await utilityDb.getModel('MonthlyWaterMeterHistory');

        // Fetch all meter IDs belonging to this facility
        const facilityMeters = await WaterMeter
            .find({ facilityId: new ObjectId(facilityId) })
            .select('_id meterNumber');

        if (!facilityMeters || facilityMeters.length === 0) {
            return reply.code(200).send({
                success: true,
                message: 'No meters found for this facility',
                facilityId,
                totalMeters: 0,
                monthlyTotals: []
            });
        }

        const meterIds = facilityMeters.map(m => m._id);

        // Build the yearMonth filter
        let yearMonthFilter = {};

        if (months) {
            // Specific months passed as comma-separated string e.g. "2026-01,2026-02"
            const monthList = months.split(',').map(m => m.trim()).filter(Boolean);
            if (monthList.length === 0) {
                return reply.code(400).send({
                    success: false,
                    error: 'No valid months provided'
                });
            }
            yearMonthFilter = { $in: monthList };
        } else if (startMonth && endMonth) {
            // Range query
            yearMonthFilter = { $gte: startMonth, $lte: endMonth };
        } else {
            return reply.code(400).send({
                success: false,
                error: 'Provide either "months" (comma-separated) or "startMonth" and "endMonth" query parameters'
            });
        }

        // Aggregate: group by yearMonth, sum consumption across all facility meters
        const aggregationResult = await MonthlyWaterMeterHistory.aggregate([
            {
                $match: {
                    meterId: { $in: meterIds },
                    yearMonth: yearMonthFilter
                }
            },
            {
                $group: {
                    _id: '$yearMonth',
                    totalConsumption: { $sum: '$consumption' },
                    totalInitialReading: { $sum: '$initialReading' },
                    totalFinalReading: { $sum: '$finalReading' },
                    meterCount: { $sum: 1 } // how many meters reported data that month
                }
            },
            {
                $sort: { _id: 1 } // sort ascending by yearMonth
            },
            {
                $project: {
                    _id: 0,
                    yearMonth: '$_id',
                    totalConsumption: { $round: ['$totalConsumption', 2] },
                    totalInitialReading: { $round: ['$totalInitialReading', 2] },
                    totalFinalReading: { $round: ['$totalFinalReading', 2] },
                    meterCount: 1
                }
            }
        ]);

        // If specific months were requested, ensure all months appear in result (even with 0 data)
        let monthlyTotals = aggregationResult;

        if (months) {
            const monthList = months.split(',').map(m => m.trim()).filter(Boolean);
            const resultMap = new Map(aggregationResult.map(r => [r.yearMonth, r]));

            monthlyTotals = monthList.map(ym => {
                if (resultMap.has(ym)) {
                    return resultMap.get(ym);
                }
                // Month with no data — return zero row
                return {
                    yearMonth: ym,
                    totalConsumption: 0,
                    totalInitialReading: 0,
                    totalFinalReading: 0,
                    meterCount: 0
                };
            });
        }

        // Overall totals
        const grandTotalConsumption = monthlyTotals.reduce((sum, r) => sum + r.totalConsumption, 0);

        return reply.code(200).send({
            success: true,
            message: 'Facility monthly consumption retrieved successfully',
            facilityId,
            totalMeters: facilityMeters.length,
            grandTotalConsumption: parseFloat(grandTotalConsumption.toFixed(2)),
            recordCount: monthlyTotals.length,
            monthlyTotals
        });

    } catch (err) {
        console.error('Error in get_facility_monthly_consumption:', err);
        return reply.code(502).send({
            success: false,
            error: err.message
        });
    }
};

module.exports = get_facility_monthly_consumption;