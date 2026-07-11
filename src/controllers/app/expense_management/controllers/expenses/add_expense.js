const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const addExpense = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            budgetId,
            categoryId,  // Added categoryId field
            name,
            amount,
            type,
            date,
            dates,  // Added for recurring expenses
            status,
            description,
            receiptUrl
        } = request.body;

        // Validate required fields
        if (!name || !amount || !type) {
            return reply.code(400).send({
                error: 'Name, amount, and type are required',
            });
        }

        // Validate type enum
        if (!['RECURRING', 'ONE_TIME'].includes(type)) {
            return reply.code(400).send({
                error: 'Type must be either RECURRING or ONE_TIME',
            });
        }

        // Validate status enum if provided
        if (status && !['PAID', 'UNPAID'].includes(status)) {
            return reply.code(400).send({
                error: 'Status must be either PAID or UNPAID',
            });
        }

        const expenseModel = await getModel('Expense', payservedb.Expense.schema, facilityId);

        // Get the Approval Workflow model
        const approvalWorkflowModel = await getModel('ApprovalWorkflow', payservedb.ApprovalWorkflow.schema, facilityId);

        const approvalWorkflow = await approvalWorkflowModel.findOne({
            module: 'expenses',
            facilityId
        }).lean();

        if (!approvalWorkflow) {
            return reply.code(400).send({
                error: 'No approval workflow configured for expenses in this facility'
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

        // Handle recurring expenses - create multiple expense records
        if (type === 'RECURRING' && dates && dates.length > 0) {
            const createdExpenses = [];
            
            for (const recurringDate of dates) {
                const newExpense = await expenseModel.create({
                    facilityId,
                    budgetId,
                    categoryId,  // Include categoryId
                    name,
                    amount,
                    type,
                    date: recurringDate,
                    status: status || 'UNPAID',
                    description,
                    receiptUrl,
                    approvalWorkflowId: approvalWorkflow._id,
                    approvalStatus: 'pending',
                    currentStep: 1,
                    approvals: workflowApprovals
                });
                
                createdExpenses.push(newExpense);
            }

            return reply.code(200).send({
                message: `${createdExpenses.length} recurring expenses added successfully`,
                expenses: createdExpenses
            });
        } else {
            // Handle one-time expense
            const newExpense = await expenseModel.create({
                facilityId,
                budgetId,
                categoryId,  // Include categoryId
                name,
                amount,
                type,
                date: date || Date.now(),
                status: status || 'UNPAID',
                description,
                receiptUrl,
                approvalWorkflowId: approvalWorkflow._id,
                approvalStatus: 'pending',
                currentStep: 1,
                approvals: workflowApprovals
            });

            return reply.code(200).send({
                message: 'Expense added successfully',
                expense: newExpense
            });
        }
    } catch (err) {
        console.error('Error adding expense:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = addExpense;