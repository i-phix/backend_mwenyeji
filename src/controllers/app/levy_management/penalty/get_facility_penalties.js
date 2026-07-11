const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const MODULE_MODELS = {
    'levy': 'Levy',
    'lease': 'LeaseAgreement',
    'utility': 'Utility'
};

const get_facility_penalties = async (request, reply) => {
    try {
        const { facilityId, module } = request.params;

        if (!facilityId) {
            return reply.code(400).send({ error: 'Facility ID is required.' });
        }

        if (!MODULE_MODELS[module]) {
            return reply.code(400).send({ error: 'Invalid module specified.' });
        }

        // Get the tenant models
        const penaltyModel = await getModel('Penalty', payservedb.Penalty.schema, facilityId);
        const parentModel = await getModel(MODULE_MODELS[module], payservedb[MODULE_MODELS[module]].schema, facilityId);

        // Find all penalties for the facility with specified module
        const penalties = await penaltyModel.find({
            facilityId,
            module
        }).lean();

        if (!penalties || penalties.length === 0) {
            return reply.code(200).send({
                success: true,
                data: []
            });
        }

        // Get all parent IDs from penalties
        const parentIds = penalties.map(penalty => penalty.moduleId);

        // Fetch all associated parent records
        const parentRecords = await parentModel.find({
            _id: { $in: parentIds }
        }).lean();

        // Create a map of parent data
        const parentMap = parentRecords.reduce((acc, record) => {
            acc[record._id.toString()] = record;
            return acc;
        }, {});

        // Map penalties to include associated parent data
        const penaltiesWithData = penalties.map(penalty => {
            const parentData = parentMap[penalty.moduleId.toString()] || {};
            const parentName =
                module === 'levy' ? parentData.levyName :
                    module === 'lease' ? parentData.leaseNumber :
                        module === 'utility' ? parentData.utilityName :
                            'Unknown';

            return {
                ...penalty,
                [`${module}Id`]: penalty.moduleId,
                [`${module}Name`]: parentName || `Unknown ${module}`
            };
        });

        return reply.code(200).send({
            success: true,
            data: penaltiesWithData
        });

    } catch (err) {
        console.error('Error fetching penalties:', err);
        return reply.code(502).send({
            success: false,
            error: err.message
        });
    }
};

// Update frontend call example
const fetchLevies = async () => {
    try {
        const facilityId = await getItem("selectedFacilityId");

        // Fetch levies, reminders and penalties in parallel
        const [leviesResponse, remindersResponse, penaltiesResponse] = await Promise.all([
            makeRequest2(`${getLevies}/${facilityId}`, "GET", {}),
            makeRequest2(`${facilityReminders}/${facilityId}/levy`, "GET", {}),
            makeRequest2(`${facilityPenalties}/${facilityId}/levy`, "GET", {})
        ]);

        // Rest of the code remains the same...
    } catch (err) {
        console.error('Error fetching levies:', err);
        toastify(err.message, "error");
        setLevies([]);
        setFilteredLevies([]);
    }
};


module.exports = get_facility_penalties;