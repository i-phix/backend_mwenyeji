const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const getAllExpenseCategories = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        const expenseCategoryModel = await getModel('ExpenseCategory', payservedb.ExpenseCategory.schema, facilityId);

        const data = await expenseCategoryModel.find({
            facilityId
        }).sort({ name: 1 }).lean();

        return reply.code(200).send({
            message: 'Expense categories retrieved successfully',
            data
        });
    } catch (err) {
        console.error('Error retrieving expense categories:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = getAllExpenseCategories;