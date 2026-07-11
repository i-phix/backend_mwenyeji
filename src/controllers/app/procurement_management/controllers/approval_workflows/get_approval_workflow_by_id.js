const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');


const get_approval_workflow_by_id = async (request, reply) => {
    try {
        const { facilityId, workflowId } = request.params;

        const approvalWorkflowModel = await getModel('ApprovalWorkflow', payservedb.ApprovalWorkflow.schema, facilityId);

        const workflow = await approvalWorkflowModel
            .findOne({ _id: workflowId, facilityId })
            .populate('steps.approvers', 'firstName lastName email');

        if (!workflow) {
            return reply.code(404).send({
                error: 'Approval workflow not found'
            });
        }

        return reply.code(200).send({
            message: 'Approval workflow retrieved successfully',
            data: workflow
        });
    } catch (err) {
        console.error('Error retrieving approval workflow:', err);
        return reply.code(500).send({ error: err.message });
    }
};

module.exports = get_approval_workflow_by_id;