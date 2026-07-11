const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const get_approval_workflows = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { module } = request.query;
        
        const approvalWorkflowModel = await getModel('ApprovalWorkflow', payservedb.ApprovalWorkflow.schema, facilityId);
        
        // Build query
        const query = { facilityId };
        if (module) {
            query.module = module;
        }
        
        // Find workflows without population first
        const workflows = await approvalWorkflowModel
            .find(query)
            .sort({ module: 1 });
            
        // Process each workflow to populate User details manually
        const processedWorkflows = await Promise.all(workflows.map(async (workflow) => {
            const workflowObject = workflow.toObject();
            
            // Process each step to populate approvers
            for (const step of workflowObject.steps) {
                // Fetch User details for each approver ID
                const approverPromises = step.approvers.map(async (approverId) => {
                    const user = await payservedb.User.findById(approverId);
                    return user ? {
                        _id: user._id,
                        email: user.email || '',
                        fullName: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`
                    } : {
                        _id: approverId,
                        firstName: 'Unknown',
                        lastName: 'User'
                    };
                });
                
                step.approvers = await Promise.all(approverPromises);
            }
            
            return workflowObject;
        }));
        
        return reply.code(200).send({
            message: 'Approval workflows retrieved successfully',
            data: processedWorkflows
        });
    } catch (err) {
        console.error('Error retrieving approval workflows:', err);
        return reply.code(500).send({ error: err.message });
    }
};

module.exports = get_approval_workflows;