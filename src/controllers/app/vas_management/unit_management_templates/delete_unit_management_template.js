const mongoose = require('mongoose');
const { UnitManagementTemplate } = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const delete_unit_management_template = async (request, reply) => {
    try {
        const { facilityId, templateId } = request.params;

        // Validate IDs
        if (!facilityId || !mongoose.Types.ObjectId.isValid(facilityId)) {
            return reply.code(400).send({
                success: false,
                message: 'Invalid facility ID'
            });
        }

        if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
            return reply.code(400).send({
                success: false,
                message: 'Invalid template ID'
            });
        }

        // Get UnitManagementTemplate model
        const UnitManagementTemplateModel = await getModel(
            'UnitManagementTemplate',
            UnitManagementTemplate.schema,
            facilityId
        );

        // Find template to ensure it exists before deletion
        const existingTemplate = await UnitManagementTemplateModel.findOne({
            _id: templateId,
            facilityId
        });

        if (!existingTemplate) {
            return reply.code(404).send({
                success: false,
                message: 'Template not found'
            });
        }

        // Check if this is the default template
        if (existingTemplate.isDefault) {
            return reply.code(400).send({
                success: false,
                message: 'Cannot delete the default template. Please set another template as default first.'
            });
        }

        // Delete template
        await UnitManagementTemplateModel.deleteOne({
            _id: templateId,
            facilityId
        });

        return reply.code(200).send({
            success: true,
            message: 'Unit management template deleted successfully'
        });
    } catch (err) {
        console.error('Error deleting unit management template:', err);
        return reply.code(500).send({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    }
};

module.exports = delete_unit_management_template;