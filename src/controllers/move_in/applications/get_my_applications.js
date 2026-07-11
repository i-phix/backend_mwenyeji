const db = require('payservedb');
const logger = require('../../../../config/winston');

// GET /api/move_in/applications/my
// Returns the authenticated tenant's own applications (no landlord contact exposed)
const get_my_applications = async (request, reply) => {
    try {
        const { userId } = request.user;
        const { page = 1, limit = 10 } = request.query;

        const applications = await db.moveIn.MoveInApplication.find({ tenantId: userId })
            .sort({ createdAt: -1 })
            .lean();

        // Only expose what the tenant needs — no landlord data
        const sanitized = applications.map((a) => ({
            _id: a._id,
            unitName: a.unitName,
            facilityName: a.facilityName,
            desiredMoveInDate: a.desiredMoveInDate,
            message: a.message,
            source: a.source,
            bookingId: a.bookingId,
            status: a.status,
            adminNote: a.adminNote,
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
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
        logger.error('[move_in/applications/my] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_my_applications;
