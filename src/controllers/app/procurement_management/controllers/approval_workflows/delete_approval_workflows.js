const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const delete_approval_workflow = async (request, reply) => {
    try {
        const { facilityId, workflowId } = request.params;

        const approvalWorkflowModel = await getModel('ApprovalWorkflow', payservedb.ApprovalWorkflow.schema, facilityId);

        // Check if workflow exists
        const existingWorkflow = await approvalWorkflowModel.findOne({ _id: workflowId, facilityId });
        if (!existingWorkflow) {
            return reply.code(404).send({
                error: 'Approval workflow not found'
            });
        }

        // Delete the workflow
        await approvalWorkflowModel.findByIdAndDelete(workflowId);

        return reply.code(200).send({
            message: 'Approval workflow deleted successfully'
        });
    } catch (err) {
        console.error('Error deleting approval workflow:', err);
        return reply.code(500).send({ error: err.message });
    }
};

module.exports = delete_approval_workflow;