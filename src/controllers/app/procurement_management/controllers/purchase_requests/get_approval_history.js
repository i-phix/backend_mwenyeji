const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const get_approval_history = async (request, reply) => {
    try {
        const { facilityId, purchaseRequestId } = request.params;
        
        // Get models
        const purchaseRequestModel = await getModel('PurchaseRequest', payservedb.PurchaseRequest.schema, facilityId);
        
        // Find the purchase request with populated approver details
        const purchaseRequest = await purchaseRequestModel
            .findById(purchaseRequestId)
            .populate('approvals.approvers.userId', 'name email')
            .lean();
        
        if (!purchaseRequest) {
            return reply.code(404).send({
                error: 'Purchase request not found'
            });
        }
        
        // Format approval history in a more readable way
        const approvalHistory = purchaseRequest.approvals.map(step => {
            const approvers = step.approvers.map(approver => {
                return {
                    userId: approver.userId._id,
                    name: approver.userId.name,
                    email: approver.userId.email,
                    status: approver.status,
                    actionDate: approver.actionDate,
                    comments: approver.comments
                };
            });
            
            return {
                stepNumber: step.stepNumber,
                stepName: step.stepName,
                isCurrentStep: step.stepNumber === purchaseRequest.currentStep,
                status: step.stepNumber < purchaseRequest.currentStep 
                    ? 'completed' 
                    : step.stepNumber > purchaseRequest.currentStep 
                        ? 'pending' 
                        : purchaseRequest.approvalStatus,
                approvers: approvers
            };
        });
        
        // Calculate overall progress
        const totalSteps = purchaseRequest.approvals.length;
        const completedSteps = purchaseRequest.currentStep - 1;
        const progressPercentage = totalSteps > 0 
            ? Math.round((completedSteps / totalSteps) * 100) 
            : 0;
        
        return reply.code(200).send({
            message: 'Approval history retrieved successfully',
            data: {
                purchaseRequestId: purchaseRequest._id,
                irfNumber: purchaseRequest.irfNumber,
                currentStatus: purchaseRequest.approvalStatus,
                currentStep: purchaseRequest.currentStep,
                totalSteps: totalSteps,
                progressPercentage: progressPercentage,
                approvalHistory: approvalHistory
            }
        });
        
    } catch (err) {
        console.error('Error getting approval history:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = get_approval_history;