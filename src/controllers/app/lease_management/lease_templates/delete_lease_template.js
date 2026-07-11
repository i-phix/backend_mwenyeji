const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const delete_lease_template = async (request, reply) => {
    try {
        // Get the facilityId and templateId from the request params
        const { facilityId, templateId } = request.params;

        // Dynamically fetch the LeaseTemplate model based on the facilityId
        const leaseTemplateModel = await getModel('LeaseTemplate', payservedb.LeaseTemplate.schema, facilityId);

        // Find and delete the template
        const deletedTemplate = await leaseTemplateModel.findByIdAndDelete(templateId);

        if (!deletedTemplate) {
            return reply.code(404).send({ 
                error: 'Lease template not found.' 
            });
        }

        return reply.code(200).send({
            message: 'Lease template deleted successfully',
            leaseTemplate: deletedTemplate
        });

    } catch (err) {
        console.error('Error in delete_lease_template:', err.stack);
        return reply.code(500).send({ 
            error: 'An error occurred while deleting the lease template.' 
        });
    }
};

module.exports = delete_lease_template;