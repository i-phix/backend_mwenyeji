const db = require('payservedb');
const logger = require('../../../../../config/winston');

// GET /api/move_in/landlord/dashboard
const get_dashboard = async (request, reply) => {
    try {
        const { userId } = request.user;

        const [
            totalUnits,
            listedUnits,
            totalApplications,
            pendingApplications,
            totalBookings,
            upcomingBookings,
            unreadMessages,
        ] = await Promise.all([
            db.moveIn.MoveInUnit.countDocuments({ landlordId: userId }),
            db.moveIn.MoveInUnit.countDocuments({ landlordId: userId, isListed: true }),
            db.moveIn.MoveInApplication.countDocuments({ landlordId: userId }),
            db.moveIn.MoveInApplication.countDocuments({ landlordId: userId, status: 'pending' }),
            db.moveIn.MoveInBooking.countDocuments({ landlordId: userId }),
            db.moveIn.MoveInBooking.countDocuments({ landlordId: userId, status: { $in: ['pending', 'confirmed'] }, scheduledDate: { $gte: new Date() } }),
            db.moveIn.MoveInConversation.aggregate([
                { $match: { landlordId: userId } },
                { $group: { _id: null, total: { $sum: '$landlordUnread' } } },
            ]).then(r => r[0]?.total || 0),
        ]);

        const recentApplications = await db.moveIn.MoveInApplication.find({ landlordId: userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        return reply.code(200).send({
            success: true,
            data: {
                stats: { totalUnits, listedUnits, totalApplications, pendingApplications, totalBookings, upcomingBookings, unreadMessages },
                recentApplications,
            },
        });
    } catch (err) {
        logger.error('[move_in/landlord/dashboard] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_dashboard;
