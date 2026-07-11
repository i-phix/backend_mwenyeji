const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const add_reminder = async (request, reply) => {
    try {
        const {
            name,
            time,
            type, // Required field
            notificationTypes,
            moduleId, // Using moduleId instead of levyId to align with schema
            module, // Required field
            remindOn,
            message,
            timezone = "UTC" // Default to UTC timezone
        } = request.body;
        const { facilityId } = request.params;

        // Validate required fields
        if (!name || !time || !notificationTypes || !moduleId || !module || !type) {
            return reply.code(400).send({
                success: false,
                error: 'Missing required fields in request body'
            });
        }

        // Validate module type
        if (!["levy", "lease", "utility"].includes(module)) {
            return reply.code(400).send({
                success: false,
                error: 'Module must be one of: levy, lease, utility'
            });
        }

        // Validate that at least one reminder trigger is enabled
        if (!remindOn.invoiceDate && !remindOn.dueDate && !remindOn.afterOverdue?.enabled) {
            return reply.code(400).send({
                success: false,
                error: 'At least one reminder trigger must be enabled'
            });
        }

        // Validate overdue reminder settings
        if (remindOn.afterOverdue?.enabled) {
            // Check if daily reminders are enabled
            const isDailyEnabled = remindOn.afterOverdue.daily === true;

            // If not daily, validate the days array
            if (!isDailyEnabled) {
                // Make sure days array exists and is not empty
                if (!remindOn.afterOverdue.days || !Array.isArray(remindOn.afterOverdue.days) || remindOn.afterOverdue.days.length === 0) {
                    return reply.code(400).send({
                        success: false,
                        error: 'When overdue reminders are enabled and not daily, specific days must be provided'
                    });
                }

                // Validate that all days are valid (1, 3, or 7)
                const validDays = [1, 3, 7];
                const invalidDays = remindOn.afterOverdue.days.filter(day => !validDays.includes(day));

                if (invalidDays.length > 0) {
                    return reply.code(400).send({
                        success: false,
                        error: `Invalid days in overdue reminder: ${invalidDays.join(', ')}. Only values 1, 3, and 7 are allowed.`
                    });
                }
            }
        }

        // Format the remindOn object
        const formattedRemindOn = {
            invoiceDate: remindOn.invoiceDate ?? true,
            dueDate: remindOn.dueDate ?? false,
            afterOverdue: {
                enabled: remindOn.afterOverdue?.enabled ?? false,
                daily: remindOn.afterOverdue?.daily ?? false,
                days: remindOn.afterOverdue?.enabled
                    ? (remindOn.afterOverdue.daily
                        ? [] // Empty array if daily is true
                        : remindOn.afterOverdue.days)
                    : [] // Empty array if not enabled
            }
        };

        const reminderModel = await getModel('Reminder', payservedb.Reminder.schema, facilityId);

        // Check if a reminder with this name already exists for this module item
        const reminderExist = await reminderModel.findOne({
            name,
            moduleId,
            module
        });

        if (reminderExist) {
            throw new Error(`Reminder already exists for this ${module}.`);
        }

        // Create reminder
        const data = new reminderModel({
            facilityId,
            name,
            type,
            time,
            notificationTypes,
            moduleId,
            module,
            remindOn: formattedRemindOn,
            message: message || '',
            timezone,
            isActive: true
        });

        await data.save();

        return reply.code(200).send({
            success: true,
            message: 'Reminder has been added.',
            data: data
        });
    } catch (err) {
        console.error('Error in add_reminder:', err);
        return reply.code(502).send({
            success: false,
            error: err.message
        });
    }
};

module.exports = add_reminder;