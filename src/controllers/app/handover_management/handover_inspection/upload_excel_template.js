const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const upload_excel_template = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { name, description, isDefault } = request.body;
        
        // Ensure file was uploaded
        if (!request.file) {
            return reply.code(400).send({
                success: false,
                error: 'No Excel file uploaded.'
            });
        }
        
        // Validate required fields
        if (!name) {
            return reply.code(400).send({
                success: false,
                error: 'Template name is required.'
            });
        }
        
        // Get the inspection settings model for this facility
        const inspectionSettingsModel = await getModel('HomeInspectionSettings', payservedb.HomeInspectionSettings.schema, facilityId);
        
        // Use the static method to create from Excel
        const userId = request.user ? request.user._id : null;
        const inspectionSettings = await inspectionSettingsModel.schema.statics.createFromExcel(
            request.file.buffer,
            facilityId,
            name,
            description || '',
            userId
        );
        
        // Update isDefault if provided
        if (isDefault !== undefined) {
            inspectionSettings.isDefault = isDefault === 'true';
            await inspectionSettings.save();
        }
        
        return reply.code(201).send({
            success: true,
            message: 'Inspection template created successfully from Excel file',
            data: inspectionSettings
        });
    } catch (err) {
        console.error('Error in upload_excel_template:', err);
        
        return reply.code(500).send({
            success: false,
            error: err.message || 'An error occurred while creating inspection template from Excel.'
        });
    }
};

module.exports = upload_excel_template;