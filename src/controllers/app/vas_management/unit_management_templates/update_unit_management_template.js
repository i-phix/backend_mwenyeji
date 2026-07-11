const mongoose = require('mongoose');
const { UnitManagementTemplate } = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const update_unit_management_template = async (request, reply) => {
    try {
        const { facilityId, templateId } = request.params;
        const { name, description, templateContent } = request.body;

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

        // Validate required fields
        if (!name && !description && !templateContent) {
            return reply.code(400).send({
                success: false,
                message: 'At least one field (name, description, or templateContent) is required'
            });
        }

        // Get UnitManagementTemplate model
        const UnitManagementTemplateModel = await getModel(
            'UnitManagementTemplate',
            UnitManagementTemplate.schema,
            facilityId
        );

        // Check if template exists
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

        // Check if updating name and if new name already exists
        if (name && name !== existingTemplate.name) {
            const duplicateName = await UnitManagementTemplateModel.findOne({
                facilityId,
                name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
                _id: { $ne: templateId }
            });

            if (duplicateName) {
                return reply.code(409).send({
                    success: false,
                    message: 'A template with this name already exists'
                });
            }
        }

        // Prepare update object
        const updateData = {};
        if (name) updateData.name = name;
        if (description) updateData.description = description;
        if (templateContent) updateData.templateContent = templateContent;
        updateData.updatedAt = new Date();

        // Update template
        const updatedTemplate = await UnitManagementTemplateModel.findOneAndUpdate(
            { _id: templateId, facilityId },
            { $set: updateData },
            { new: true } // Return the updated document
        );

        return reply.code(200).send({
            success: true,
            message: 'Unit management template updated successfully',
            data: updatedTemplate
        });
    } catch (err) {
        console.error('Error updating unit management template:', err);
        return reply.code(500).send({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    }
};

module.exports = update_unit_management_template;