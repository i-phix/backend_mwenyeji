const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const approve_expense = async (request, reply) => {
  try {
    const { facilityId, expenseId } = request.params;
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
    const ExpenseModel = await getModel(
      'Expense',
      payservedb.Expense.schema,
      facilityId
    );

    // Find the expense document
    const expense = await ExpenseModel.findById(expenseId);
    if (!expense) {
      return reply.code(404).send({ error: 'Expense not found' });
    }

    // Check if expense is in a state that can be approved
    if (expense.approvalStatus === 'approved') {
      return reply.code(400).send({ error: 'Expense is already approved' });
    }
    if (expense.approvalStatus === 'rejected') {
      return reply.code(400).send({ error: 'Expense is already rejected' });
    }

    // Locate the current approval step
    const currentStepIndex = expense.approvals.findIndex(
      step => step.stepNumber === expense.currentStep
    );
    if (currentStepIndex === -1) {
      return reply.code(400).send({ error: 'Current approval step not found' });
    }
    const currentStep = expense.approvals[currentStepIndex];

    // Check that this userId is in the approvers list for the current step
    const approverIndex = currentStep.approvers.findIndex(
      approver => String(approver.userId) === String(userId)
    );
    if (approverIndex === -1) {
      return reply.code(403).send({ error: 'You are not authorized to approve this expense' });
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
        const nextExists = expense.approvals.some(
          step => step.stepNumber === expense.currentStep + 1
        );
        if (nextExists) {
          expense.currentStep += 1;
          expense.approvalStatus = 'in_progress';
        } else {
          expense.currentStep = null;
          expense.approvalStatus = 'approved';
          // REMOVED: expense.status = 'approved'; // This was causing the error
        }
      } else {
        // any rejection => fully rejected
        expense.currentStep = null;
        expense.approvalStatus = 'rejected';
        // REMOVED: expense.status = 'rejected'; // This was causing the error
      }
    } else {
      // still waiting on other approvers
      expense.approvalStatus = 'in_progress';
    }

    // Persist changes
    await expense.save();

    const updated = await payservedb.Expense
      .findById(expenseId)
      .populate('approvals.approvers.userId', 'name email')
      .lean();

    return reply.code(200).send({
      message: approve ? 'Expense approved' : 'Expense rejected',
      data: updated
    });
  } catch (err) {
    console.error('Error in approve_expense:', err);
    return reply.code(500).send({ error: err.message });
  }
};

module.exports = approve_expense;