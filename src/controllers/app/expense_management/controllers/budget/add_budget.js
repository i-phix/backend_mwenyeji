const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const addBudget = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const {
      name,
      allocation,
      startDate,
      endDate,
      department,
      overruns,
      userName
    } = request.body;

    // Validate required fields
    if (!name || !allocation || !startDate || !endDate || !department) {
      return reply.code(400).send({
        error: 'Name, allocation, startDate, endDate, and department are required',
      });
    }

    const budgetModel = await getModel('Budget', payservedb.Budget.schema, facilityId);

    // Get the Approval Workflow model
    const approvalWorkflowModel = await getModel('ApprovalWorkflow', payservedb.ApprovalWorkflow.schema, facilityId);

    const approvalWorkflow = await approvalWorkflowModel.findOne({
      module: 'budgets',
      facilityId
    }).lean();

    if (!approvalWorkflow) {
      return reply.code(400).send({
        error: 'No approval workflow configured for budgets in this facility'
      });
    }

    // Build workflow approvals
    const workflowApprovals = approvalWorkflow.steps.map(step => ({
      stepNumber: step.stepNumber,
      stepName: step.name,
      approvers: step.approvers.map(userId => ({
        userId: userId.toString(),
        status: 'pending',
        actionDate: null,
        comments: ''
      }))
    }));

    const newBudget = await budgetModel.create({
      facilityId,
      budgetName: name,
      allocation,
      startDate,
      endDate,
      department,
      overruns: !!overruns, 
      userName: userName || '',
      approvalWorkflowId: approvalWorkflow._id,
      approvalStatus: 'pending',
      currentStep: 1,
      approvals: workflowApprovals
    });

    return reply.code(200).send({
      message: 'Budget added successfully',
      budget: newBudget
    });
  } catch (err) {
    console.error('Error adding budget:', err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = addBudget;
