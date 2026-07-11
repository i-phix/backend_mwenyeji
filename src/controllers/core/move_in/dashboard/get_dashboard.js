const db = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const logger = require('../../../../../config/winston');

// GET /api/core/move_in/dashboard
const get_dashboard = async (request, reply) => {
    try {
        const facilities = await db.Facility.find({}).select('_id').lean();

        let totalListings = 0;
        let pendingApprovals = 0;

        await Promise.all(
            facilities.map(async (facility) => {
                try {
                    const UnitModel = await getModel('Unit', db.Unit.schema, facility._id);
                    const [listed, pending] = await Promise.all([
                        UnitModel.countDocuments({ listedInMoveIn: true }),
                        UnitModel.countDocuments({ moveInApproval: 'pending' }),
                    ]);
                    totalListings += listed;
                    pendingApprovals += pending;
                } catch (e) {
                    logger.error(`[move_in/dashboard] facility ${facility._id}: ${e.message}`);
                }
            })
        );

        const [activeCustomers, openApplications] = await Promise.all([
            db.User.countDocuments({ type: 'Customer', isEnabled: true }),
            db.moveIn.MoveInApplication.countDocuments({ status: 'pending' }),
        ]);

        const recentActivity = await db.moveIn.MoveInApplication.find({})
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        const activity = recentActivity.map((a) => ({
            title: `${a.tenantName || 'Tenant'} applied for ${a.unitName || 'a unit'}`,
            time: new Date(a.createdAt).toLocaleString('en-KE'),
            status: a.status,
        }));

        return reply.code(200).send({
            success: true,
            data: {
                stats: { totalListings, pendingApprovals, activeCustomers, openApplications },
                recentActivity: activity,
            },
        });
    } catch (err) {
        logger.error('[core/move_in/dashboard] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_dashboard;
