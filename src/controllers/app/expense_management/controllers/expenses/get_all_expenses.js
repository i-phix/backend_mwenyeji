const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const getAllExpenses = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { 
            categoryId,
            type,
            status,
            startDate,
            endDate 
        } = request.query;

        // Get both models
        const expenseModel = await getModel('Expense', payservedb.Expense.schema, facilityId);
        const expenseCategoryModel = await getModel('ExpenseCategory', payservedb.ExpenseCategory.schema, facilityId);

        const query = { facilityId };
        
        if (categoryId) query.categoryId = categoryId;
        if (type) query.type = type;
        if (status) query.status = status;
        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const expenses = await expenseModel.find(query);

        // Manually fetch category information for each expense
        const expensesWithCategoryInfo = await Promise.all(
            expenses.map(async (expense) => {
                let categoryInfo = null;
                
                if (expense.categoryId) {
                    try {
                        const category = await expenseCategoryModel.findById(expense.categoryId);
                        if (category) {
                            categoryInfo = {
                                name: category.name
                            };
                        }
                    } catch (err) {
                       
                    }
                }
                
                return {
                    ...expense.toObject(),
                    categoryInfo: categoryInfo
                };
            })
        );

        return reply.code(200).send({
            message: 'Expenses retrieved successfully',
            expenses: expensesWithCategoryInfo
        });
    } catch (err) {
        console.error('Error retrieving expenses:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = getAllExpenses;