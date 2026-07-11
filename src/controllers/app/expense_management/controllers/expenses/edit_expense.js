const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const editExpense = async (request, reply) => {
    try {
        const { facilityId, expenseId } = request.params;
        const {
            budgetId,
            categoryId,  // Added categoryId field
            name,
            amount,
            type,
            date,
            status,
            description,
            receiptUrl
        } = request.body;

        // Validate type enum if provided
        if (type && !['RECURRING', 'ONE_TIME'].includes(type)) {
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

        // Check if expense exists
        const existingExpense = await expenseModel.findById(expenseId);
        if (!existingExpense) {
            return reply.code(404).send({ error: 'Expense not found' });
        }

        // Build update object with only provided fields
        const updateData = {};
        if (budgetId !== undefined) updateData.budgetId = budgetId;
        if (categoryId !== undefined) updateData.categoryId = categoryId;
        if (name !== undefined) updateData.name = name;
        if (amount !== undefined) updateData.amount = amount;
        if (type !== undefined) updateData.type = type;
        if (date !== undefined) updateData.date = date;
        if (status !== undefined) updateData.status = status;
        if (description !== undefined) updateData.description = description;
        if (receiptUrl !== undefined) updateData.receiptUrl = receiptUrl;

        const updatedExpense = await expenseModel.findByIdAndUpdate(
            expenseId,
            updateData,
            { new: true, runValidators: true }
        );

        return reply.code(200).send({
            message: 'Expense updated successfully',
            expense: updatedExpense
        });
    } catch (err) {
        console.error('Error updating expense:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = editExpense;