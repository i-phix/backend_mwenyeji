const db = require('payservedb');
const logger = require('../../../../config/winston');

// GET /api/move_in/dashboard
const get_dashboard = async (request, reply) => {
    try {
        const { userId } = request.user;

        const [
            totalApplications,
            pendingApplications,
            approvedApplications,
            upcomingViewings,
            activeReservations,
            unreadNotifications,
            recentApplications,
        ] = await Promise.all([
            db.moveIn.MoveInApplication.countDocuments({ tenantId: userId }),
            db.moveIn.MoveInApplication.countDocuments({ tenantId: userId, status: 'pending' }),
            db.moveIn.MoveInApplication.countDocuments({ tenantId: userId, status: { $in: ['approved', 'assigned'] } }),
            db.moveIn.MoveInBooking.countDocuments({ tenantId: userId, status: { $in: ['pending', 'confirmed'] }, scheduledDate: { $gte: new Date() } }),
            db.moveIn.MoveInReservation.countDocuments({ tenantId: userId, status: { $in: ['pending', 'confirmed'] } }),
            db.moveIn.MoveInNotification.countDocuments({ recipientId: userId, recipientType: 'tenant', isRead: false }),
            db.moveIn.MoveInApplication.find({ tenantId: userId })
                .sort({ createdAt: -1 })
                .limit(5)
                .lean(),
        ]);

        const recentActivity = recentApplications.map((a) => ({
            title: `Application for ${a.unitName || 'a unit'}`,
            time: new Date(a.createdAt).toLocaleString('en-KE'),
            status: a.status,
        }));

        return reply.code(200).send({
            success: true,
            data: {
                stats: {
                    totalApplications,
                    pendingApplications,
                    approvedApplications,
                    upcomingViewings,
                    activeReservations,
                    unreadNotifications,
                },
                recentActivity,
            },
        });
    } catch (err) {
        logger.error('[move_in/dashboard] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_dashboard;
