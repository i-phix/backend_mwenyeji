const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

/**
 * Get default inspection settings for a facility
 * Route: GET /api/app/handover_management/get_default_inspection_settings/:facilityId
 */
const get_default_inspection_settings = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        
        // Get the inspection settings model for this facility
        const inspectionSettingsModel = await getModel('HomeInspectionSettings', payservedb.HomeInspectionSettings.schema, facilityId);
        
        // Find the default inspection settings
        const defaultSettings = await inspectionSettingsModel.findOne({
            facilityId,
            isDefault: true,
            active: true
        });
        
        if (!defaultSettings) {
            return reply.code(404).send({
                success: false,
                error: 'No default inspection settings found for this facility.'
            });
        }
        
        return reply.code(200).send({
            success: true,
            data: defaultSettings
        });
    } catch (err) {
        console.error('Error in get_default_inspection_settings:', err);
        
        return reply.code(500).send({
            success: false,
            error: err.message || 'An error occurred while fetching default inspection settings.'
        });
    }
};

module.exports = get_default_inspection_settings;