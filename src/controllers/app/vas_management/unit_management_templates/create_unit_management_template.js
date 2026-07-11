const mongoose = require('mongoose');
const { UnitManagementTemplate } = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const create_unit_management_template = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { name, description, templateContent, createdBy } = request.body;

        console.log('Create template request:', { facilityId, name, description, createdBy });

        // Validate facilityId
        if (!facilityId || !mongoose.Types.ObjectId.isValid(facilityId)) {
            return reply.code(400).send({
                success: false,
                message: 'Invalid facility ID'
            });
        }

        // Validate required fields
        if (!name || !description || !templateContent || !createdBy) {
            return reply.code(400).send({
                success: false,
                message: 'Name, description, template content, and creator ID are required'
            });
        }

        // Get UnitManagementTemplate model
        const UnitManagementTemplateModel = await getModel(
            'UnitManagementTemplate',
            UnitManagementTemplate.schema,
            facilityId
        );

        // Check if a template with the same name already exists
        const existingTemplate = await UnitManagementTemplateModel.findOne({
            facilityId,
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
        });

        if (existingTemplate) {
            return reply.code(409).send({
                success: false,
                message: 'A template with this name already exists'
            });
        }

        // Create new template
        const newTemplate = new UnitManagementTemplateModel({
            name: name.trim(),
            description: description.trim(),
            templateContent,
            createdBy,
            facilityId,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Save to database
        const savedTemplate = await newTemplate.save();
        
        console.log('Template saved successfully:', savedTemplate._id);

        // Return consistent success response
        return reply.code(201).send({
            success: true,
            message: 'Unit management template created successfully',
            data: savedTemplate
        });
        
    } catch (err) {
        console.error('Error creating unit management template:', err);
        
        // Return error response
        return reply.code(500).send({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Server error'
        });
    }
};

module.exports = create_unit_management_template;