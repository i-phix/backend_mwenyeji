const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

/**
 * Delete inspection settings
 * Route: DELETE /api/app/handover_management/delete_inspection_settings/:facilityId/:inspectionId
 */
const delete_inspection_settings = async (request, reply) => {
    try {
        const { facilityId, inspectionId } = request.params;
        
        // Get the inspection settings model for this facility
        const inspectionSettingsModel = await getModel('HomeInspectionSettings', payservedb.HomeInspectionSettings.schema, facilityId);
        
        // Check if inspection settings exist
        const existingSettings = await inspectionSettingsModel.findById(inspectionId);
        
        if (!existingSettings) {
            return reply.code(404).send({
                success: false,
                error: `Inspection settings with ID ${inspectionId} not found.`
            });
        }
        
        // Delete inspection settings
        await inspectionSettingsModel.findByIdAndDelete(inspectionId);
        
        return reply.code(200).send({
            success: true,
            message: 'Inspection settings deleted successfully'
        });
    } catch (err) {
        console.error('Error in delete_inspection_settings:', err);
        
        return reply.code(500).send({
            success: false,
            error: err.message || 'An error occurred while deleting inspection settings.'
        });
    }
};

module.exports = delete_inspection_settings;