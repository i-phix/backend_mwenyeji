const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const create_lease_reminder = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            name,
            type = 'standard',
            remindOn,
            time,
            notificationTypes,
            message,
            moduleId
        } = request.body;

        // Basic validation
        if (!name?.trim()) {
            return reply.code(400).send({
                success: false,
                error: 'Name is required'
            });
        }

        if (!moduleId) {
            return reply.code(400).send({
                success: false,
                error: 'Module ID is required'
            });
        }

        // Notification types validation
        if (!Array.isArray(notificationTypes) || notificationTypes.length === 0) {
            return reply.code(400).send({
                success: false,
                error: 'At least one notification type is required'
            });
        }

        const validTypes = notificationTypes.every(type =>
            ['SMS', 'EMAIL'].includes(type.toUpperCase())
        );
        if (!validTypes) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid notification types. Must be SMS or EMAIL'
            });
        }

        // Time format validation
        if (!time || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
            return reply.code(400).send({
                success: false,
                error: 'Time must be in HH:mm format'
            });
        }

        // Remind on validation
        if (!remindOn?.invoiceDate && !remindOn?.dueDate && !remindOn?.afterOverdue?.enabled) {
            return reply.code(400).send({
                success: false,
                error: 'At least one reminder option must be selected'
            });
        }

        // Modified validation for overdue reminders
        if (remindOn?.afterOverdue?.enabled) {
            // Check if either daily is true OR specific days are selected
            if (!remindOn.afterOverdue.daily &&
                (!Array.isArray(remindOn.afterOverdue.days) || remindOn.afterOverdue.days.length === 0)) {
                return reply.code(400).send({
                    success: false,
                    error: 'When overdue reminders are enabled, either daily reminders must be enabled or specific days must be selected'
                });
            }

            // Only validate specific days if daily is false and days are provided
            if (!remindOn.afterOverdue.daily && Array.isArray(remindOn.afterOverdue.days) && remindOn.afterOverdue.days.length > 0) {
                // Validate overdue days values
                const validDays = remindOn.afterOverdue.days.every(day =>
                    [1, 3, 7].includes(Number(day))
                );
                if (!validDays) {
                    return reply.code(400).send({
                        success: false,
                        error: 'Overdue reminder days must be 1, 3, or 7'
                    });
                }
            }
        }

        // Message length validation
        if (message && message.length > 500) {
            return reply.code(400).send({
                success: false,
                error: 'Message cannot exceed 500 characters'
            });
        }

        const reminderModel = await getModel('Reminder', payservedb.Reminder.schema, facilityId);

        // Check for existing reminder
        const existingReminder = await reminderModel.findOne({
            name: name.trim(),
            facilityId,
            module: 'lease'
        });

        if (existingReminder) {
            return reply.code(400).send({
                success: false,
                error: 'A reminder with this name already exists in this facility'
            });
        }

        // Prepare reminder data - include the daily property
        const reminderData = {
            name: name.trim(),
            type,
            module: 'lease',
            moduleId,
            remindOn: {
                invoiceDate: !!remindOn?.invoiceDate,
                dueDate: !!remindOn?.dueDate,
                afterOverdue: {
                    enabled: !!remindOn?.afterOverdue?.enabled,
                    daily: !!remindOn?.afterOverdue?.daily,
                    days: remindOn?.afterOverdue?.enabled && !remindOn?.afterOverdue?.daily ?
                        remindOn.afterOverdue.days.map(Number).filter(day => [1, 3, 7].includes(day)) :
                        []
                }
            },
            time,
            isActive: true,
            processed: false,
            lastProcessed: null,
            notificationTypes: notificationTypes.map(type => type.toUpperCase()),
            message: (message || '').trim(),
            facilityId,
            // Always set timezone to UTC
            timezone: 'UTC'
        };

        // Create reminder
        const reminder = await reminderModel.create(reminderData);

        return reply.code(200).send({
            success: true,
            message: 'Lease reminder created successfully',
            data: reminder
        });

    } catch (error) {
        console.error('Error in create_lease_reminder:', error);
        return reply.code(500).send({
            success: false,
            error: 'Failed to create lease reminder',
            details: error.message
        });
    }
};

module.exports = create_lease_reminder;