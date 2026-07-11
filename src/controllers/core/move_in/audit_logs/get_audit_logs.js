const db = require('payservedb');
const logger = require('../../../../../config/winston');

// GET /api/core/move_in/audit_logs
const get_audit_logs = async (request, reply) => {
    try {
        const { page = 1, limit = 30, resourceType, search } = request.query;

        const filter = {};
        if (resourceType && resourceType !== 'All') filter.resourceType = resourceType;
        if (search) filter.action = { $regex: search, $options: 'i' };

        const total = await db.moveIn.MoveInAuditLog.countDocuments(filter);
        const skip = (Number(page) - 1) * Number(limit);

        const logs = await db.moveIn.MoveInAuditLog.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean();
        const adminIds = logs.map((log) => log.adminId).filter(Boolean);
        const admins = adminIds.length
            ? await db.User.find({ _id: { $in: adminIds } }).select('fullName email').lean()
            : [];
        const adminMap = {};
        admins.forEach((admin) => {
            adminMap[String(admin._id)] = admin;
        });
        const enrichedLogs = logs.map((log) => ({
            ...log,
            adminId: log.adminId ? (adminMap[String(log.adminId)] || log.adminId) : null,
        }));

        return reply.code(200).send({
            success: true,
            data: enrichedLogs,
            pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
        });
    } catch (err) {
        logger.error('[core/move_in/audit_logs] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_audit_logs;
