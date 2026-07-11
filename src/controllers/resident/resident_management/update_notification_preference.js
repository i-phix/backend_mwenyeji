const payservedb = require('payservedb');

const updateNotificationPreferences = async (request, reply) => {
    try {
        const { residentId } = request.params;
        const { notificationPreferences } = request.body;

        // Validate notificationPreferences
        if (!notificationPreferences || typeof notificationPreferences !== 'object') {
            return reply.code(400).send({ error: 'Invalid notification preferences' });
        }

        // Validate each field in notificationPreferences
        const validFields = ['email', 'sms', 'push'];
        const invalidFields = Object.keys(notificationPreferences).filter(field => !validFields.includes(field));
        
        if (invalidFields.length) {
            return reply.code(400).send({ error: `Invalid fields in notification preferences: ${invalidFields.join(', ')}` });
        }

        // Find and update the resident's notification preferences
        const updatedResident = await payservedb.Resident.findOneAndUpdate(
            { residentId },
            { notificationPreferences },
            { new: true }
        );

        if (!updatedResident) {
            return reply.code(404).send({ error: 'Resident not found' });
        }

        // Return updated resident with the new notification preferences
        return reply.code(200).send({ message: 'Notification preferences updated successfully', updatedResident });
    } catch (err) {
        console.error('Error updating notification preferences:', err); // Log the error
        return reply.code(502).send({ error: 'Internal Server Error', details: err.message });
    }
};

module.exports = updateNotificationPreferences;
