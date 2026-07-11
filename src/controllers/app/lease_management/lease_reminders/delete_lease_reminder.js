// controllers/lease/reminders/delete_lease_reminder.js
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const delete_lease_reminder = async (request, reply) => {
    try {
        const { facilityId, reminderId } = request.params;
        const reminderModel = await getModel('Reminder', payservedb.Reminder.schema, facilityId);

        // Check if reminder exists and is active
        const existingReminder = await reminderModel.findOne({
            _id: reminderId,
            facilityId,
            module: 'lease',
            isActive: true
        });

        if (!existingReminder) {
            return reply.code(404).send({
                error: 'Active lease reminder not found'
            });
        }

        // Check if this is a one-time reminder that hasn't been processed
        if (existingReminder.type === 'onetime' && !existingReminder.processed) {
            const scheduledDate = new Date(existingReminder.scheduledDate);
            if (scheduledDate > new Date()) {
                return reply.code(400).send({
                    error: 'Cannot delete an unprocessed one-time reminder. Deactivate it instead.'
                });
            }
        }

        // Check if reminder is in use by any lease agreements
        const leaseAgreementModel = await getModel('LeaseAgreement', payservedb.LeaseAgreement.schema, facilityId);
        const isInUse = await leaseAgreementModel.exists({
            'reminders.reminderId': reminderId,
            status: { $in: ['Active', 'Pending'] }
        });

        if (isInUse) {
            return reply.code(400).send({
                error: 'Cannot delete reminder as it is currently in use by active lease agreements'
            });
        }

        // Soft delete by setting isActive to false
        const deletedReminder = await reminderModel.findByIdAndUpdate(
            reminderId,
            { 
                isActive: false,
                deactivatedAt: new Date(),
                deactivatedReason: request.body.reason || 'User requested deletion'
            },
            { new: true }
        );

        return reply.code(200).send({
            message: 'Lease reminder deleted successfully',
            data: deletedReminder
        });

    } catch (error) {
        console.error('Error in delete_lease_reminder:', error);
        return reply.code(500).send({
            error: 'Failed to delete lease reminder',
            details: error.message
        });
    }
};

module.exports = delete_lease_reminder;