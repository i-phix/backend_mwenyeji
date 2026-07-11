const payservedb = require('payservedb'); // Assuming this includes your models
const { getModel } = require('../../../../utils/getModel');

const get_lease_template = async (request, reply) => {
    try {
        const { facilityId, templateId } = request.params;

        // Get the LeaseTemplate model for the specified facility
        const leaseTemplateModel = await getModel('LeaseTemplate', payservedb.LeaseTemplate.schema, facilityId);

        // Fetch specific template
        const template = await leaseTemplateModel.findById(templateId);
        
        if (!template) {
            return reply.code(404).send({ error: 'Template not found' });
        }

        return reply.code(200).send(template);
    } catch (err) {
        console.error('Error fetching lease template:', err);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_lease_template;