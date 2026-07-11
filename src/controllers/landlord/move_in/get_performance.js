const db = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const logger = require('../../../../config/winston');

// GET /api/landlord/move_in/performance
const get_performance = async (request, reply) => {
    try {
        const { userId } = request.user;

        const landlord = await db.User.findById(userId).lean();
        if (!landlord || landlord.type !== 'Landlord') {
            return reply.code(403).send({ error: 'Access denied.' });
        }

        const facilityIds = (landlord.customerData || [])
            .filter((d) => d.isEnabled)
            .map((d) => d.facilityId);

        const facilities = await db.Facility.find({ _id: { $in: facilityIds } })
            .select('_id name location')
            .lean();

        const unitStats = [];
        let totalViews = 0;
        let totalApplications = 0;
        let totalOccupied = 0;
        let totalUnits = 0;

        await Promise.all(
            facilities.map(async (facility) => {
                try {
                    const customerData = landlord.customerData.find(
                        (d) => d.facilityId.toString() === facility._id.toString()
                    );
                    const UnitModel = await getModel('Unit', db.Unit.schema, facility._id);
                    const units = await UnitModel.find({
                        homeOwnerId: customerData?.customerId,
                        listedInMoveIn: true,
                    }).select('name tenantId').lean();

                    for (const unit of units) {
                        const applications = await db.moveIn.MoveInApplication.countDocuments({
                            unitId: unit._id,
                            facilityId: facility._id,
                        });

                        const isOccupied = !!unit.tenantId;

                        unitStats.push({
                            unitName: unit.name,
                            facilityName: facility.name,
                            views: 0,       // placeholder — views tracking not yet implemented
                            applications,
                            occupiedUnits: isOccupied ? 1 : 0,
                            totalUnits: 1,
                            revenue: 0,     // placeholder — will come from lease/payment data
                        });

                        totalApplications += applications;
                        if (isOccupied) totalOccupied++;
                        totalUnits++;
                    }
                } catch (e) {
                    logger.error(`[landlord/move_in/performance] facility ${facility._id}: ${e.message}`);
                }
            })
        );

        return reply.code(200).send({
            success: true,
            data: {
                summary: {
                    totalViews,
                    totalApplications,
                    occupiedUnits: totalOccupied,
                    totalUnits,
                    totalRevenue: 0,
                },
                units: unitStats,
            },
        });
    } catch (err) {
        logger.error('[landlord/move_in/performance] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_performance;
