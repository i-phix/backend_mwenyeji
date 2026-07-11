const mongoose = require('mongoose');
const { UnitManagementTemplate } = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_unit_management_templates = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        // Validate facilityId
        if (!facilityId || !mongoose.Types.ObjectId.isValid(facilityId)) {
            return reply.code(400).send({
                success: false,
                message: 'Invalid facility ID'
            });
        }

        // Get UnitManagementTemplate model
        const UnitManagementTemplateModel = await getModel(
            'UnitManagementTemplate',
            UnitManagementTemplate.schema,
            facilityId
        );

        // Find all templates for this facility
        const templates = await UnitManagementTemplateModel.find({
            facilityId
        }).sort({ createdAt: -1 }).lean();

        return reply.code(200).send({
            success: true,
            message: templates.length > 0 
                ? 'Unit management templates retrieved successfully'
                : 'No unit management templates found for this facility',
            data: templates
        });
    } catch (err) {
        console.error('Error fetching unit management templates:', err);
        return reply.code(500).send({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    }
};

module.exports = get_unit_management_templates;