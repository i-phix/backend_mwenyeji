const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const approve_purchase_request = async (request, reply) => {
  try {
    const { facilityId, purchaseRequestId } = request.params;
    const { approve, comments = '', userId } = request.body;

    // Validate required inputs
    if (approve === undefined) {
      return reply.code(400).send({
        error: 'Approval decision is required (true for approve, false for reject)'
      });
    }
    if (!userId) {
      return reply.code(400).send({
        error: 'userId is required in the request body'
      });
    }

    // Load the models for this facility
    const PurchaseRequestModel = await getModel(
      'PurchaseRequest',
      payservedb.PurchaseRequest.schema,
      facilityId
    );

    // Find the purchase request document
    const purchaseRequest = await PurchaseRequestModel.findById(purchaseRequestId);
    if (!purchaseRequest) {
      return reply.code(404).send({ error: 'Purchase request not found' });
    }

    // Locate the current approval step
    const currentStepIndex = purchaseRequest.approvals.findIndex(
      step => step.stepNumber === purchaseRequest.currentStep
    );
    if (currentStepIndex === -1) {
      return reply.code(400).send({ error: 'Current approval step not found' });
    }
    const currentStep = purchaseRequest.approvals[currentStepIndex];

    // Check that this userId is in the approvers list for the current step
    const approverIndex = currentStep.approvers.findIndex(
      approver => String(approver.userId) === String(userId)
    );
    if (approverIndex === -1) {
      return reply.code(403).send({ error: 'You are not authorized to approve this request' });
    }

    // Ensure they haven't already acted
    if (currentStep.approvers[approverIndex].status !== 'pending') {
      return reply.code(400).send({ error: 'You have already provided your decision' });
    }

    // Record the decision
    currentStep.approvers[approverIndex].status = approve ? 'approved' : 'rejected';
    currentStep.approvers[approverIndex].actionDate = new Date();
    currentStep.approvers[approverIndex].comments = comments;

    // Determine new overall approvalStatus/currentStep
    const allResponded = currentStep.approvers.every(a => a.status !== 'pending');
    if (allResponded) {
      const allApproved = currentStep.approvers.every(a => a.status === 'approved');
      if (allApproved) {
        // advance to next step, or finalize
        const nextExists = purchaseRequest.approvals.some(
          step => step.stepNumber === purchaseRequest.currentStep + 1
        );
        if (nextExists) {
          purchaseRequest.currentStep += 1;
          purchaseRequest.approvalStatus = 'in_progress';
        } else {
          purchaseRequest.currentStep = null;
          purchaseRequest.approvalStatus = 'approved';
          purchaseRequest.status = 'approved';
        }
      } else {
        // any rejection => fully rejected
        purchaseRequest.currentStep = null;
        purchaseRequest.approvalStatus = 'rejected';
        purchaseRequest.status = 'rejected';
      }
    } else {
      // still waiting on other approvers
      purchaseRequest.approvalStatus = 'in_progress';
    }

    // Persist changes
    await purchaseRequest.save();

    // FIXED: Use payservedb.PurchaseRequest instead of facility-specific model for populate
    // This ensures the User model is available on the same connection
    const updated = await payservedb.PurchaseRequest
      .findById(purchaseRequestId)
      .populate('approvals.approvers.userId', 'name email')
      .lean();

    return reply.code(200).send({
      message: approve ? 'Purchase request approved' : 'Purchase request rejected',
      data: updated
    });
  } catch (err) {
    console.error('Error in approve_purchase_request:', err);
    return reply.code(500).send({ error: err.message });
  }
};

module.exports = approve_purchase_request;