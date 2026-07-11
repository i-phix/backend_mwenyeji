const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const update_reminder_status = async (request, reply) => {
    try {
        const { isActive } = request.body;  // Get reminderId and the new isActive status
        const { facilityId, reminderId } = request.params;  // Get the facilityId from the URL params

        // Validate required fields in the request body
        if (reminderId === undefined || reminderId === null) {
            return reply
                .code(400)
                .send({ error: "Reminder ID is required" });
        }

        if (isActive === undefined || isActive === null) {
            return reply
                .code(400)
                .send({ error: "New status (isActive) is required" });
        }

        // Get the reminder model for the given facilityId
        const reminderModel = await getModel('Reminder', payservedb.Reminder.schema, facilityId);

        // Find the reminder by reminderId
        const reminder = await reminderModel.findOne({ _id: reminderId, facilityId });

        if (!reminder) {
            return reply
                .code(404)
                .send({ error: "Reminder not found" });
        }

        // Update the reminder status
        reminder.isActive = isActive;

        // Save the updated reminder object
        const updatedReminder = await reminder.save();

        // Return success response
        return reply.code(200).send({ message: "Reminder status updated successfully" });
    } catch (err) {
        // Handle errors and send error response
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = update_reminder_status;
