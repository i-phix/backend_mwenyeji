const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const edit_lease_template = async (request, reply) => {
    try {
        // Get the facilityId and templateId from the request params
        const { facilityId, templateId } = request.params;

        // Extract fields from the request body
        const {
            name,
            description,
            templateContent,
            leaseAgreementId
        } = request.body;

        // Validate if at least one field is provided for update
        if (!name && !description && !templateContent && !leaseAgreementId) {
            return reply.code(400).send({ 
                error: 'At least one field must be provided for update.' 
            });
        }

        // Dynamically fetch the LeaseTemplate model based on the facilityId
        const leaseTemplateModel = await getModel('LeaseTemplate', payservedb.LeaseTemplate.schema, facilityId);

        // Find the existing template
        const existingTemplate = await leaseTemplateModel.findById(templateId);
        
        if (!existingTemplate) {
            return reply.code(404).send({ 
                error: 'Lease template not found.' 
            });
        }

        // Create update object with only provided fields
        const updateData = {};
        if (name) updateData.name = name;
        if (description) updateData.description = description;
        if (templateContent) updateData.templateContent = templateContent;
        if (leaseAgreementId) updateData.leaseAgreementId = leaseAgreementId;

        // Update the template
        const updatedTemplate = await leaseTemplateModel.findByIdAndUpdate(
            templateId,
            updateData,
            { new: true } // Return the updated document
        );

        return reply.code(200).send({
            message: 'Lease template updated successfully',
            leaseTemplate: updatedTemplate
        });

    } catch (err) {
        console.error('Error in edit_lease_template:', err.stack);
        return reply.code(500).send({ 
            error: 'An error occurred while updating the lease template.' 
        });
    }
};

module.exports = edit_lease_template;