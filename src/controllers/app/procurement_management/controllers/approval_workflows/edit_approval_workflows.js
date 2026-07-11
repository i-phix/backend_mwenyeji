const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const update_approval_workflow = async (request, reply) => {
    try {
        const { facilityId, workflowId } = request.params;
        const { module, steps } = request.body;
        
        // Basic validation
        if ((!module && !steps) || (steps && !steps.length)) {
            return reply.code(400).send({
                error: 'At least one field to update must be provided, and steps cannot be empty if provided'
            });
        }
        
        // Validate each step has required fields if steps are provided
        if (steps) {
            for (const step of steps) {
                if (!step.stepNumber || !step.name || !step.approvers || !step.approvers.length) {
                    return reply.code(400).send({
                        error: 'Each step must have a step number, name, and at least one approver'
                    });
                }
            }
        }
        
        const approvalWorkflowModel = await getModel('ApprovalWorkflow', payservedb.ApprovalWorkflow.schema, facilityId);
        
        // Check if workflow exists
        const existingWorkflow = await approvalWorkflowModel.findOne({ _id: workflowId, facilityId });
        if (!existingWorkflow) {
            return reply.code(404).send({
                error: 'Approval workflow not found'
            });
        }
        
        // If module is changing, check for duplicates
        if (module && module !== existingWorkflow.module) {
            const duplicateModule = await approvalWorkflowModel.findOne({ module, facilityId });
            if (duplicateModule) {
                return reply.code(400).send({
                    error: `An approval workflow for ${module} already exists`
                });
            }
        }
        
        // Prepare update data
        const updateData = {};
        if (module) updateData.module = module;
                
        if (steps) {
            // Sort steps by step number to ensure correct sequence
            updateData.steps = [...steps].sort((a, b) => a.stepNumber - b.stepNumber);
        }
        
        // Update the workflow
        const updatedWorkflow = await approvalWorkflowModel.findByIdAndUpdate(
            workflowId,
            { $set: updateData },
            { new: true }
        );
        
        // Manually populate approver details
        const workflowObject = updatedWorkflow.toObject();
        
        // Process each step to populate approvers
        for (const step of workflowObject.steps) {
            // Fetch customer details for each approver ID
            const approverPromises = step.approvers.map(async (approverId) => {
                const customer = await payservedb.Customer.findById(approverId);
                return customer ? {
                    _id: customer._id,
                    firstName: customer.firstName || '',
                    lastName: customer.lastName || '',
                    email: customer.email || '',
                    fullName: customer.fullName || `${customer.firstName || ''} ${customer.lastName || ''}`
                } : {
                    _id: approverId,
                    firstName: 'Unknown',
                    lastName: 'User'
                };
            });
            
            step.approvers = await Promise.all(approverPromises);
        }
        
        return reply.code(200).send({
            message: 'Approval workflow updated successfully',
            data: workflowObject
        });
    } catch (err) {
        console.error('Error updating approval workflow:', err);
        return reply.code(500).send({ error: err.message });
    }
};

module.exports = update_approval_workflow;