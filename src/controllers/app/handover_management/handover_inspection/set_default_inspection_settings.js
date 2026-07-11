const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

/**
 * Set inspection settings as default
 * Route: PUT /api/app/handover_management/set_default_inspection_settings/:facilityId/:inspectionId
 */
const set_default_inspection_settings = async (request, reply) => {
    try {
        const { facilityId, inspectionId } = request.params;
        
        // Get the inspection settings model for this facility
        const inspectionSettingsModel = await getModel('HomeInspectionSettings', payservedb.HomeInspectionSettings.schema, facilityId);
        
        // Check if the inspection settings exist
        const inspectionSettings = await inspectionSettingsModel.findById(inspectionId);
        
        if (!inspectionSettings) {
            return reply.code(404).send({
                success: false,
                error: `Inspection settings with ID ${inspectionId} not found.`
            });
        }
        
        // Reset any existing default settings
        await inspectionSettingsModel.updateMany(
            { facilityId, isDefault: true },
            { isDefault: false }
        );
        
        // Set the requested settings as default
        inspectionSettings.isDefault = true;
        await inspectionSettings.save();
        
        return reply.code(200).send({
            success: true,
            message: 'Default inspection settings updated successfully',
            data: inspectionSettings
        });
    } catch (err) {
        console.error('Error in set_default_inspection_settings:', err);
        
        return reply.code(500).send({
            success: false,
            error: err.message || 'An error occurred while setting default inspection settings.'
        });
    }
};

module.exports = set_default_inspection_settings;