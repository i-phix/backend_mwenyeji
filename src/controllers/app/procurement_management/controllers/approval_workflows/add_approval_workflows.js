const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const create_approval_workflow = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { module, steps } = request.body;

        // Basic validation
        if (!module || !steps || !steps.length) {
            return reply.code(400).send({
                error: 'Module name and at least one step are required'
            });
        }

        // Validate each step has required fields
        for (const step of steps) {
            if (!step.stepNumber || !step.name || !step.approvers || !step.approvers.length) {
                return reply.code(400).send({
                    error: 'Each step must have a step number, name, and at least one approver'
                });
            }
        }

        const approvalWorkflowModel = await getModel('ApprovalWorkflow', payservedb.ApprovalWorkflow.schema, facilityId);

        // Check if a workflow for this module already exists
        const existingWorkflow = await approvalWorkflowModel.findOne({ module, facilityId });
        if (existingWorkflow) {
            return reply.code(400).send({
                error: `An approval workflow for ${module} already exists`
            });
        }

        // Sort steps by step number to ensure correct sequence
        const sortedSteps = [...steps].sort((a, b) => a.stepNumber - b.stepNumber);

        // Create the new approval workflow
        const newApprovalWorkflow = {
            module,
            facilityId,
            steps: sortedSteps
        };

        const savedWorkflow = await approvalWorkflowModel.create(newApprovalWorkflow);

        return reply.code(200).send({
            message: 'Approval workflow created successfully',
            data: savedWorkflow
        });
    } catch (err) {
        console.error('Error creating approval workflow:', err);
        return reply.code(500).send({ error: err.message });
    }
};

module.exports = create_approval_workflow;