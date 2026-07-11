const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const assign_template_to_service_request = async (request, reply) => {
    try {
        const { facilityId, requestId } = request.params;
        const { templateId } = request.body;

        // Validate parameters
        if (!facilityId || !mongoose.Types.ObjectId.isValid(facilityId)) {
            return reply.code(400).send({
                success: false,
                message: 'Invalid facility ID'
            });
        }

        if (!requestId || !mongoose.Types.ObjectId.isValid(requestId)) {
            return reply.code(400).send({
                success: false,
                message: 'Invalid request ID'
            });
        }

        if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
            return reply.code(400).send({
                success: false,
                message: 'Invalid template ID'
            });
        }

        // Get models
        const ServiceRequest = await getModel('ServiceRequest', payservedb.ServiceRequest.schema, facilityId);
        const UnitManagementTemplate = await getModel('UnitManagementTemplate', payservedb.UnitManagementTemplate.schema, facilityId);

        // Verify service request exists
        const serviceRequest = await ServiceRequest.findById(requestId);

        if (!serviceRequest) {
            return reply.code(404).send({
                success: false,
                message: 'Service request not found'
            });
        }

        // Verify template exists
        const template = await UnitManagementTemplate.findOne({
            _id: templateId,
            facilityId
        });

        if (!template) {
            return reply.code(404).send({
                success: false,
                message: 'Template not found'
            });
        }

        // Update service request with template ID
        serviceRequest.templateId = templateId;
        await serviceRequest.save();

        return reply.code(200).send({
            success: true,
            message: 'Template assigned to service request successfully',
            data: {
                serviceRequest: {
                    _id: serviceRequest._id,
                    templateId: serviceRequest.templateId
                },
                template: {
                    _id: template._id,
                    name: template.name
                }
            }
        });
    } catch (err) {
        console.error('Error assigning template to service request:', err);
        return reply.code(500).send({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    }
};

module.exports = assign_template_to_service_request;