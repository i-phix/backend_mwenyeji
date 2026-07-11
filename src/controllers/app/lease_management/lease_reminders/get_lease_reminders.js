const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const get_lease_reminders = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        if (!facilityId) {
            return reply.code(400).send({
                success: false,
                error: 'Facility ID is required'
            });
        }

        const reminderModel = await getModel('Reminder', payservedb.Reminder.schema, facilityId);

        const query = { 
            facilityId,
            module: 'lease'
        };

        const reminders = await reminderModel.find(query)
            .select('name type notificationTypes time isActive timezone remindOn')
            .sort({ name: 1 })
            .lean()
            .exec();

        // Ensure we're returning an array
        const data = Array.isArray(reminders) ? reminders : [];

        return reply.code(200).send({
            success: true,
            data: data,
            count: data.length
        });

    } catch (error) {
        console.error('Error in get_lease_reminders:', error);
        return reply.code(500).send({
            success: false,
            error: 'Failed to fetch lease reminders',
            details: error.message
        });
    }
};

module.exports = get_lease_reminders;