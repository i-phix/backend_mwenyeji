const db = require('payservedb');
const logger = require('../../../../config/winston');
const { ensureMoveInLandlordForPayServeUser, landlordRecordFilter, sendError } = require('./context');

// GET /api/landlord/move_in/bookings
// Backward-compatible alias for landlord Move-In applications.
const get_bookings = async (request, reply) => {
    try {
        const { userId } = request.user;

        const { moveInLandlord } = await ensureMoveInLandlordForPayServeUser(userId);

        const { status = 'All', page = 1, limit = 20 } = request.query;

        const filter = landlordRecordFilter({ payserveUserId: userId, moveInLandlordId: moveInLandlord._id });
        if (status !== 'All') filter.status = status;

        const applications = await db.moveIn.MoveInApplication.find(filter)
            .sort({ createdAt: -1 })
            .lean();

        const sanitized = applications.map((a) => ({
            _id: a._id,
            unitName: a.unitName,
            facilityName: a.facilityName,
            tenantRef: `REF-${a._id.toString().slice(-6).toUpperCase()}`,
            tenantName: a.tenantName || '—',
            tenantEmail: a.tenantEmail || null,
            tenantPhone: a.tenantPhone || null,
            desiredMoveInDate: a.desiredMoveInDate,
            message: a.message,
            status: a.status,
            adminNote: a.adminNote,
            assignedAt: a.assignedAt,
            createdAt: a.createdAt,
        }));

        const total = sanitized.length;
        const skip = (Number(page) - 1) * Number(limit);
        const paginated = sanitized.slice(skip, skip + Number(limit));

        return reply.code(200).send({
            success: true,
            data: paginated,
            pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
        });
    } catch (err) {
        logger.error('[landlord/move_in/get_bookings] ' + err.message);
        return sendError(reply, err);
    }
};

module.exports = get_bookings;
