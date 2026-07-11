const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const approve_budget = async (request, reply) => {
  try {
    const { facilityId, budgetId } = request.params;
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
    const BudgetModel = await getModel(
      'Budget',
      payservedb.Budget.schema,
      facilityId
    );

    // Find the budget document
    const budget = await BudgetModel.findById(budgetId);
    if (!budget) {
      return reply.code(404).send({ error: 'Budget not found' });
    }

    // Check if budget is in a state that can be approved
    if (budget.approvalStatus === 'approved') {
      return reply.code(400).send({ error: 'Budget is already approved' });
    }
    if (budget.approvalStatus === 'rejected') {
      return reply.code(400).send({ error: 'Budget is already rejected' });
    }

    // Locate the current approval step
    const currentStepIndex = budget.approvals.findIndex(
      step => step.stepNumber === budget.currentStep
    );
    if (currentStepIndex === -1) {
      return reply.code(400).send({ error: 'Current approval step not found' });
    }
    const currentStep = budget.approvals[currentStepIndex];

    // Check that this userId is in the approvers list for the current step
    const approverIndex = currentStep.approvers.findIndex(
      approver => String(approver.userId) === String(userId)
    );
    if (approverIndex === -1) {
      return reply.code(403).send({ error: 'You are not authorized to approve this budget' });
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
        const nextExists = budget.approvals.some(
          step => step.stepNumber === budget.currentStep + 1
        );
        if (nextExists) {
          budget.currentStep += 1;
          budget.approvalStatus = 'in_progress';
        } else {
          budget.currentStep = null;
          budget.approvalStatus = 'approved';
        }
      } else {
        // any rejection => fully rejected
        budget.currentStep = null;
        budget.approvalStatus = 'rejected';
      }
    } else {
      // still waiting on other approvers
      budget.approvalStatus = 'in_progress';
    }

    // Persist changes
    await budget.save();

    const updated = await payservedb.Budget
      .findById(budgetId)
      .populate('approvals.approvers.userId', 'name email')
      .lean();

    return reply.code(200).send({
      message: approve ? 'Budget approved' : 'Budget rejected',
      data: updated
    });
  } catch (err) {
    console.error('Error in approve_budget:', err);
    return reply.code(500).send({ error: err.message });
  }
};

module.exports = approve_budget;