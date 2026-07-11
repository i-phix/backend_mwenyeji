// controllers/lease/reminders/update_lease_reminder.js
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const moment = require('moment-timezone');

const update_lease_reminder = async (request, reply) => {
    try {
        const { facilityId, reminderId } = request.params;
        const updates = request.body;

        const reminderModel = await getModel('Reminder', payservedb.Reminder.schema, facilityId);

        // Ensure reminder exists
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

        // Validate type if being updated
        if (updates.type && !['standard', 'custom'].includes(updates.type)) {
            return reply.code(400).send({
                error: 'Type must be either standard or custom'
            });
        }

        // Validate notification types if being updated
        if (updates.notificationTypes) {
            if (!Array.isArray(updates.notificationTypes) || 
                updates.notificationTypes.length === 0 ||
                !updates.notificationTypes.every(type => ['SMS', 'EMAIL'].includes(type.toUpperCase()))) {
                return reply.code(400).send({
                    error: 'At least one valid notification type (SMS or EMAIL) is required'
                });
            }
            updates.notificationTypes = updates.notificationTypes.map(type => type.toUpperCase());
        }

        // Validate time format if being updated
        if (updates.time && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(updates.time)) {
            return reply.code(400).send({
                error: 'Time must be in HH:mm format'
            });
        }

        // Validate timezone if being updated
        if (updates.timezone && !moment.tz.names().includes(updates.timezone)) {
            return reply.code(400).send({
                error: 'Invalid timezone'
            });
        }

        // Validate remindOn structure if being updated
        if (updates.remindOn?.afterOverdue?.enabled) {
            const validDays = [1, 3, 7];
            if (!Array.isArray(updates.remindOn.afterOverdue.days) || 
                !updates.remindOn.afterOverdue.days.every(day => validDays.includes(day))) {
                return reply.code(400).send({
                    error: 'When overdue reminders are enabled, days can only be 1, 3, or 7'
                });
            }
        }

        // Validate message length if being updated
        if (updates.message && updates.message.length > 500) {
            return reply.code(400).send({
                error: 'Message cannot exceed 500 characters'
            });
        }

        // Check name uniqueness if being updated
        if (updates.name && updates.name !== existingReminder.name) {
            const nameExists = await reminderModel.findOne({
                name: updates.name,
                facilityId,
                _id: { $ne: reminderId }
            });

            if (nameExists) {
                return reply.code(400).send({
                    error: 'A reminder with this name already exists in this facility'
                });
            }
        }

        // Prevent changing module
        updates.module = 'lease';

        const updatedReminder = await reminderModel.findByIdAndUpdate(
            reminderId,
            { $set: updates },
            { 
                new: true,
                runValidators: true 
            }
        );

        return reply.code(200).send({
            message: 'Lease reminder updated successfully',
            data: updatedReminder
        });

    } catch (error) {
        console.error('Error in update_lease_reminder:', error);
        return reply.code(500).send({
            error: 'Failed to update lease reminder',
            details: error.message
        });
    }
};

module.exports = update_lease_reminder;