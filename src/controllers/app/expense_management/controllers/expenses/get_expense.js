const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const getExpenseById = async (request, reply) => {
    try {
        const { facilityId, expenseId } = request.params;

        const expenseModel = await getModel('Expense', payservedb.Expense.schema, facilityId);

        const expense = await expenseModel
            .findById(expenseId)
            .populate('categoryId', 'title');

        if (!expense) {
            return reply.code(404).send({ error: 'Expense not found' });
        }

        return reply.code(200).send({
            message: 'Expense retrieved successfully',
            expense
        });
    } catch (err) {
        
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = getExpenseById;