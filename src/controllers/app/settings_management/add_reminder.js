const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const add_reminder = async (request, reply) => {
    try {
        const { name, type, time, day, notificationTypes, message, levyId, scheduledDate, frequency } = request.body; // Added scheduledDate and frequency
        const { facilityId } = request.params;

        if (!name || !type || !time || !notificationTypes || !message || !levyId) {
            return reply.code(400).send({ error: 'Missing required fields in request body' });
        }

        const reminderModel = await getModel('Reminder', payservedb.Reminder.schema, facilityId);

        const reminderExist = await reminderModel.findOne({ name });

        if (reminderExist) {
            logger.error('Reminder already exists for name:', name);
            throw new Error('Reminder already exists.')
        } else {
            let data = new reminderModel({
                facilityId,
                name,
                type,
                time,
                day: type === 'recurring' ? 'Monday' : day,
                notificationTypes,
                message,
                levyId,
                scheduledDate: type === 'onetime' ? scheduledDate : undefined, // Only add scheduledDate for onetime reminders
                frequency: type === 'recurring' ? frequency : undefined // Only add frequency for recurring reminders
            });

            const response = await data.save();

            return reply.code(200).send({ message: 'Reminder has been added.' });
        }
    } catch (err) {
        return reply.code(502).send({ error: err.message });
    }
}
module.exports = add_reminder;  
