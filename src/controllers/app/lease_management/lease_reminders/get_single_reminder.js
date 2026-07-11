// controllers/lease/reminders/get_lease_reminder.js
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const get_lease_reminder = async (request, reply) => {
    try {
        const { facilityId, reminderId } = request.params;

        const reminderModel = await getModel('Reminder', payservedb.Reminder.schema, facilityId);

        const reminder = await reminderModel.findOne({
            _id: reminderId,
            facilityId,
            module: 'lease'
        });

        if (!reminder) {
            return reply.code(404).send({
                error: 'Lease reminder not found'
            });
        }

        return reply.code(200).send({
            message: 'Lease reminder retrieved successfully',
            data: reminder
        });

    } catch (error) {
        console.error('Error in get_lease_reminder:', error);
        return reply.code(500).send({
            error: 'Failed to fetch lease reminder',
            details: error.message
        });
    }
};

module.exports = get_lease_reminder;