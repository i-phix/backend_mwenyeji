const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const MODULE_MODELS = {
    'levy': 'Levy',
    'lease': 'LeaseAgreement',
    'utility': 'Utility'
};

const get_facility_reminders = async (request, reply) => {
    try {
        const { facilityId, module } = request.params;

        if (!facilityId) {
            return reply.code(400).send({ error: 'Facility ID is required.' });
        }

        if (!MODULE_MODELS[module]) {
            return reply.code(400).send({ error: 'Invalid module specified.' });
        }

        // Get the tenant models
        const reminderModel = await getModel('Reminder', payservedb.Reminder.schema, facilityId);
        const parentModel = await getModel(MODULE_MODELS[module], payservedb[MODULE_MODELS[module]].schema, facilityId);

        // Find all reminders for the facility with specified module
        const reminders = await reminderModel.find({ 
            facilityId,
            module
        }).lean();

        if (!reminders || reminders.length === 0) {
            return reply.code(200).send({ 
                success: true,
                data: [] 
            });
        }

        // Get all parent IDs from reminders
        const parentIds = reminders.map(reminder => reminder.moduleId);

        // Fetch all associated parent records
        const parentRecords = await parentModel.find({
            _id: { $in: parentIds }
        }).lean();

        // Create a map of parent data
        const parentMap = parentRecords.reduce((acc, record) => {
            acc[record._id.toString()] = record;
            return acc;
        }, {});

        // Map reminders to include associated parent data
        const remindersWithData = reminders.map(reminder => {
            const parentData = parentMap[reminder.moduleId.toString()] || {};
            const parentName = 
                module === 'levy' ? parentData.levyName :
                module === 'lease' ? parentData.leaseNumber :
                module === 'utility' ? parentData.utilityName :
                'Unknown';

            return {
                ...reminder,
                [`${module}Id`]: reminder.moduleId,
                [`${module}Name`]: parentName || `Unknown ${module}`
            };
        });

        return reply.code(200).send({
            success: true,
            data: remindersWithData
        });

    } catch (err) {
        console.error('Error fetching reminders:', err);
        return reply.code(502).send({ 
            success: false,
            error: err.message 
        });
    }
};

module.exports = get_facility_reminders;