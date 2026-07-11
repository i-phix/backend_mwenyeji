const mongoose = require('mongoose');
const { UnitManagementTemplate } = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const get_unit_management_template = async (request, reply) => {
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

        // Find template
        const template = await UnitManagementTemplateModel.findOne({
            _id: templateId,
            facilityId
        }).lean();

        // Check if template exists
        if (!template) {
            return reply.code(404).send({
                success: false,
                message: 'Template not found'
            });
        }

        return reply.code(200).send({
            success: true,
            message: 'Unit management template retrieved successfully',
            data: template
        });
    } catch (err) {
        console.error('Error fetching unit management template:', err);
        return reply.code(500).send({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    }
};

module.exports = get_unit_management_template;