const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

/**
 * Get inspection settings filtered by category
 * Route: GET /api/app/handover_management/get_inspection_settings_by_category/:facilityId/:inspectionId
 */
const get_inspection_settings_by_category = async (request, reply) => {
    try {
        const { facilityId, inspectionId } = request.params;
        const { category } = request.query;
        
        if (!category) {
            return reply.code(400).send({
                success: false,
                error: 'Category parameter is required.'
            });
        }
        
        // Get the inspection settings model for this facility
        const inspectionSettingsModel = await getModel('HomeInspectionSettings', payservedb.HomeInspectionSettings.schema, facilityId);
        
        // Find the inspection settings
        const inspectionSettings = await inspectionSettingsModel.findById(inspectionId);
        
        if (!inspectionSettings) {
            return reply.code(404).send({
                success: false,
                error: `Inspection settings with ID ${inspectionId} not found.`
            });
        }
        
        // Filter items by category
        const filteredItems = inspectionSettings.items.filter(item => 
            item.category === category && item.active
        );
        
        return reply.code(200).send({
            success: true,
            count: filteredItems.length,
            category,
            data: filteredItems
        });
    } catch (err) {
        console.error('Error in get_inspection_settings_by_category:', err);
        
        return reply.code(500).send({
            success: false,
            error: err.message || 'An error occurred while fetching inspection items by category.'
        });
    }
};

module.exports = get_inspection_settings_by_category;