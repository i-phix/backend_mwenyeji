const db = require('payservedb');
const logger = require('../../../../../config/winston');

const get_reminders = async (request, reply) => {
    try {
        const { relatedType, relatedId, page = 1, limit = 30 } = request.query || {};
        const filter = {};
        if (relatedType) filter.relatedType = relatedType;
        if (relatedId) filter.relatedId = relatedId;

        const pageNum = Math.max(1, Number(page) || 1);
        const limitNum = Math.max(1, Number(limit) || 30);
        const total = await db.moveIn.MoveInReminder.countDocuments(filter);
        const reminders = await db.moveIn.MoveInReminder.find(filter)
            .sort({ createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .lean();

        return reply.code(200).send({
            success: true,
            data: reminders,
            pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
        });
    } catch (err) {
        logger.error('[core/move_in/reminders/get] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_reminders;
