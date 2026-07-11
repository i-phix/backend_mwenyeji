const payservedb = require('payservedb');

const deleteReminder = async (request, reply) => {
    try {
        const { reminderId } = request.params;

        const reminder = await payservedb.Reminder.findById(reminderId);

        // Only allow deletion if the record is disabled
        if (!reminder.disabled) {
            return reply.code(403).send({ error: 'You can only delete a disabled record' });
        }

        await payservedb.Reminder.findByIdAndDelete(reminderId);

        return reply.code(200).send('Reminder deleted successfully');
    } catch (err) {
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = deleteReminder

