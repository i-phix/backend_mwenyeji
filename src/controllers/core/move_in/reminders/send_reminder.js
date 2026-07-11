const db = require('payservedb');
const logger = require('../../../../../config/winston');
const { enrichRows } = require('../../../move_in/utils/workflow_context');
const { sendMoveInReminder } = require('../../../move_in/utils/reminders');

const modelForType = (type) => {
    if (type === 'application') return db.moveIn.MoveInApplication;
    if (type === 'reservation') return db.moveIn.MoveInReservation;
    if (type === 'viewing') return db.moveIn.MoveInBooking;
    return null;
};

const send_reminder = async (request, reply) => {
    try {
        const { relatedType, relatedId, target = 'both', channels = ['email'], subject, message } = request.body || {};
        const model = modelForType(relatedType);
        if (!model || !relatedId) return reply.code(400).send({ error: 'relatedType and relatedId are required.' });
        if (!message || !String(message).trim()) return reply.code(400).send({ error: 'message is required.' });

        const row = await model.findById(relatedId).lean();
        if (!row) return reply.code(404).send({ error: 'Record not found.' });
        const [related] = await enrichRows([row], relatedType);

        const reminder = await sendMoveInReminder({
            relatedType,
            related,
            target,
            channels,
            subject: subject || `Move-In reminder: ${related.unitName || relatedType}`,
            message,
            actorId: request.user?.userId || null,
            actorType: 'admin',
        });

        return reply.code(200).send({ success: true, data: reminder });
    } catch (err) {
        logger.error('[core/move_in/reminders/send] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = send_reminder;
