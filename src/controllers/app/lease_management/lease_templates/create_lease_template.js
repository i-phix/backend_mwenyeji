const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const add_lease_template = async (request, reply) => {
    try {
        // Get the facilityId from the request params
        const { facilityId } = request.params;

        // Extract fields from the request body
        const {
            name,
            description,
            templateContent,
            leaseAgreementId,
            createdBy
        } = request.body;

        // Validate required fields
        if (!name || !description || !templateContent || !createdBy) {
            return reply.code(400).send({ error: 'Missing required fields in the request body.' });
        }

        // Dynamically fetch the LeaseTemplate model based on the facilityId
        const leaseTemplateModel = await getModel('LeaseTemplate', payservedb.LeaseTemplate.schema, facilityId);

        // Create and save the LeaseTemplate document
        const leaseTemplate = await leaseTemplateModel.create({
            name,
            description,
            templateContent,
            createdBy
        });

        // Return success response
        return reply.code(200).send({
            message: 'Lease Template added successfully',
            leaseTemplate
        });
    } catch (err) {
        // Log and return errors
        console.error('Error in add_lease_template:', err.stack);
        return reply.code(500).send({ error: 'An error occurred while adding the lease template.' });
    }
};

module.exports = add_lease_template;
