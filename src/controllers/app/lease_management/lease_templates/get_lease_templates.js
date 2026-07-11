const payservedb = require('payservedb'); // Assuming this includes your models
const { getModel } = require('../../../../utils/getModel');

const get_lease_templates = async (request, reply) => {
    try {
        const { facilityId } = request.params; // Extract facilityId from route parameters
        console.log(`Fetching lease templates for facilityId: ${facilityId}`);

        // Get the LeaseTemplate model for the specified facility
        const leaseTemplateModel = await getModel('LeaseTemplate', payservedb.LeaseTemplate.schema, facilityId);

        // Fetch all lease templates for the specified facility
        const templates = await leaseTemplateModel.find();

        return reply.code(200).send(templates);
    } catch (err) {
        console.error('Error fetching lease templates:', err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_lease_templates;