// controllers/lease/reminders/toggle_lease_reminder_status.js
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const toggle_lease_reminder_status = async (request, reply) => {
    try {
        const { facilityId, reminderId } = request.params;
        const { isActive } = request.body;

        // Validate isActive parameter
        if (typeof isActive !== 'boolean') {
            return reply.code(400).send({
                error: 'isActive must be a boolean value'
            });
        }

        const reminderModel = await getModel('Reminder', payservedb.Reminder.schema, facilityId);

        // Check if reminder exists and belongs to the facility
        const existingReminder = await reminderModel.findOne({
            _id: reminderId,
            facilityId,
            module: 'lease'
        });

        if (!existingReminder) {
            return reply.code(404).send({
                error: 'Lease reminder not found'
            });
        }

        // Update reminder status
        const updatedReminder = await reminderModel.findByIdAndUpdate(
            reminderId,
            {
                $set: {
                    isActive: isActive,
                    processed: false, // Reset processed status when toggling
                    lastProcessed: null, // Clear last processed date when status changes
                    updatedAt: new Date()
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!updatedReminder) {
            return reply.code(500).send({
                error: 'Failed to update reminder status'
            });
        }

        // Log activity for audit trail
        console.log(`Reminder ${reminderId} status changed to ${isActive ? 'active' : 'inactive'} in facility ${facilityId}`);

        return reply.code(200).send({
            message: `Reminder ${isActive ? 'activated' : 'deactivated'} successfully`,
            data: {
                _id: updatedReminder._id,
                name: updatedReminder.name,
                isActive: updatedReminder.isActive,
                processed: updatedReminder.processed,
                lastProcessed: updatedReminder.lastProcessed,
                updatedAt: updatedReminder.updatedAt
            }
        });

    } catch (error) {
        console.error('Error in toggle_lease_reminder_status:', error);

        // Handle specific MongoDB errors
        if (error.name === 'CastError') {
            return reply.code(400).send({
                error: 'Invalid reminder ID format'
            });
        }

        if (error.name === 'ValidationError') {
            return reply.code(400).send({
                error: 'Validation error',
                details: error.message
            });
        }

        return reply.code(500).send({
            error: 'Failed to update reminder status',
            details: error.message
        });
    }
};

module.exports = toggle_lease_reminder_status;