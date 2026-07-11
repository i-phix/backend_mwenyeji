const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const get_inspection_settings_by_id = async (request, reply) => {
    try {
        const { facilityId, inspectionId } = request.params;
        
        // Get the inspection settings model for this facility
        const inspectionSettingsModel = await getModel('HomeInspectionSettings', payservedb.HomeInspectionSettings.schema, facilityId);
        
        // Fetch inspection settings by ID
        const inspectionSettings = await inspectionSettingsModel.findById(inspectionId);
        
        if (!inspectionSettings) {
            return reply.code(404).send({
                success: false,
                error: `Inspection settings with ID ${inspectionId} not found.`
            });
        }
        
        return reply.code(200).send({
            success: true,
            data: inspectionSettings
        });
    } catch (err) {
        console.error('Error in get_inspection_settings_by_id:', err);
        
        return reply.code(500).send({
            success: false,
            error: err.message || 'An error occurred while fetching inspection settings.'
        });
    }
};

module.exports = get_inspection_settings_by_id;