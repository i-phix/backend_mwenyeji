const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const update_reminder = async (request, reply) => {
    try {
        const { reminderId } = request.params;
        const updates = request.body;

        const reminderModel = await getModel('Reminder', payservedb.Reminder.schema, updates.facilityId);

        const updatedReminder = await reminderModel.findByIdAndUpdate(reminderId, updates, { new: true });

        if (!updatedReminder) {
            return reply.code(404).send({ error: 'Reminder not found.' });
        }

        return reply.code(200).send(updatedReminder);
    } catch (err) {
        console.error('Error updating reminder:', err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = update_reminder;
