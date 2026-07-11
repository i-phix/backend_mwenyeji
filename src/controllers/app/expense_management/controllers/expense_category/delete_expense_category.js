const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const deleteExpenseCategory = async (request, reply) => {
    try {
        const { facilityId, categoryId } = request.params;

        const expenseCategoryModel = await getModel('ExpenseCategory', payservedb.ExpenseCategory.schema, facilityId);

        // Check if category exists
        const expenseCategory = await expenseCategoryModel.findOne({
            _id: categoryId,
            facilityId
        }).lean();

        if (!expenseCategory) {
            return reply.code(404).send({
                error: 'Expense category not found'
            });
        }

        // Check if category is being used by any expenses before deletionW
        
        const expenseModel = await getModel('Expense', payservedb.Expense.schema, facilityId);
        const expensesUsingCategory = await expenseModel.countDocuments({
            facilityId,
            categoryId: categoryId
        });

        if (expensesUsingCategory > 0) {
            return reply.code(400).send({
                error: 'Cannot delete expense category as it is being used by existing expenses'
            });
        }
        

        await expenseCategoryModel.deleteOne({
            _id: categoryId,
            facilityId
        });

        return reply.code(200).send({
            message: 'Expense category deleted successfully'
        });
    } catch (err) {
        console.error('Error deleting expense category:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = deleteExpenseCategory;